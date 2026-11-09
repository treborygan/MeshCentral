'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

if (!process.env.MESHCENTRAL_SOURCE_ROOT) {
  throw new Error('Set MESHCENTRAL_SOURCE_ROOT to the exact pinned upstream source or extracted package before running authorization contracts.');
}
const root = path.resolve(process.env.MESHCENTRAL_SOURCE_ROOT);
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

// Extract the production function body and execute it without rewriting its
// logic. This keeps these small contract tests attached to the upstream source
// while avoiding a live server, agent, account, or relay connection.
function extractFunction(source, declaration) {
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `source function not found: ${declaration}`);
  const open = source.indexOf('{', start + declaration.length);
  assert.notEqual(open, -1, `function body not found: ${declaration}`);
  let depth = 0, quote = null, lineComment = false, blockComment = false, escape = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && next === '/') { lineComment = true; i++; continue; }
    if (c === '/' && next === '*') { blockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail(`unterminated function: ${declaration}`);
}

function invokeSourceFunction(source, declaration, globals, receiver, args) {
  const fn = extractFunction(source, declaration);
  const context = vm.createContext(globals);
  const functionName = declaration.match(/(?:function\s+|\.)([A-Za-z_$][\w$]*)\s*\(/)?.[1];
  assert.ok(functionName, `function name not found: ${declaration}`);
  vm.runInContext(`${fn}; globalThis.__tested = ${functionName};`, context, { timeout: 1000 });
  return context.__tested.apply(receiver, args);
}

function createFileRelay(rights) {
  const sent = [];
  const nodeid = 'node/domain/device';
  const agent = { dbMeshKey: 'mesh/domain/group', dbNodeKey: nodeid, send: message => sent.push(JSON.parse(message)) };
  const server = {
    relaySessionCount: 0,
    relaySessionErrorCount: 0,
    wsagents: { [nodeid]: agent },
    wsrelays: {},
    wsPeerRelays: {},
    meshes: { [agent.dbMeshKey]: { consent: 0 } },
    GetNodeRights: () => rights,
    GetRoutingServerIdNotSelf: () => null,
    parent: {
      loginCookieEncryptionKey: 'test-key',
      encodeCookie: () => 'test-cookie',
      debug: () => {},
      multiServer: null,
      DispatchEvent: () => {}
    }
  };
  const request = { query: { id: 'relay-test', f: 'file.txt' }, clientIp: '127.0.0.1' };
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (callback, delay) => ({ callback, delay });
  try {
    const relay = require(path.join(root, 'meshdevicefile.js')).CreateMeshDeviceFile(
      server, null, null, request, { id: 'domain' }, { _id: 'user/domain/alice', name: 'alice' },
      agent.dbMeshKey, nodeid, null
    );
    return { relay, sent, server };
  } finally {
    global.setTimeout = originalSetTimeout;
  }
}

test('direct Agent file relay denies No Files and missing remote-control rights', () => {
  for (const rights of [8 | 1024, 1024]) {
    const { sent, relay } = createFileRelay(rights);
    assert.equal(sent.length, 0, 'denied rights must not send a devicefile tunnel request to the Agent');
    assert.equal(relay.id, undefined, 'the denied relay identifier is discarded');
  }
});

test('direct Agent file relay permits file-capable remote control and administrator rights', () => {
  for (const rights of [8, 0xFFFFFFFF]) {
    const { sent } = createFileRelay(rights);
    assert.equal(sent.length, 1, 'a permitted request sends exactly one tunnel request');
    assert.equal(sent[0].type, 'tunnel');
    assert.equal(sent[0].soptions.usages[0], 10);
    assert.equal(sent[0].rights, rights);
  }
});

test('Agent protocol 10 rejects file transfer before opening or reading a path', () => {
  const source = read('agents/meshcore.js');
  const socket = {
    httprequest: {
      state: 1, protocol: 0, rights: 8 | 1024,
      soptions: { usages: [10] },
      xoptions: { file: 'sensitive.txt' },
      s: { endCount: 0, end() { this.endCount++; } }
    },
    writes: [],
    write(value) { this.writes.push(value); }
  };
  invokeSourceFunction(source, 'function onTunnelData(data)', {
    process, Buffer, require, fs,
    MESHRIGHT_REMOTECONTROL: 8, MESHRIGHT_NOFILES: 1024, MESHRIGHT_ADMIN: 0xFFFFFFFF,
    sendConsoleText: () => {}, MeshServerLogEx: () => {}
  }, socket, ['10']);
  assert.equal(socket.httprequest.protocol, 999999);
  assert.equal(socket.httprequest.s.endCount, 1);
  assert.deepEqual(socket.writes, [], 'denied file request must not emit transfer data');
});

test('Agent protocol 10 permits ordinary file rights and administrator rights', () => {
  const source = read('agents/meshcore.js');
  for (const rights of [8, 0xFFFFFFFF]) {
    const socket = {
      httprequest: {
        state: 1, protocol: 0, rights,
        soptions: { usages: [10] },
        xoptions: { file: path.join(root, 'file-that-does-not-exist.test') },
        s: { endCount: 0, end() { this.endCount++; } }
      },
      writes: [],
      write(value) { this.writes.push(value); }
    };
    invokeSourceFunction(source, 'function onTunnelData(data)', {
      process, Buffer, require, fs,
      MESHRIGHT_REMOTECONTROL: 8, MESHRIGHT_NOFILES: 1024, MESHRIGHT_ADMIN: 0xFFFFFFFF,
      sendConsoleText: () => {}, MeshServerLogEx: () => {}
    }, socket, ['10']);
    assert.equal(socket.httprequest.protocol, 10, 'allowed file protocol continues into file handling');
    assert.equal(socket.httprequest.s.endCount, 0);
    assert.deepEqual(socket.writes.map(JSON.parse), [{ op: 'cancel' }]);
  }
});

test('pending 2FA blocks the actual websocket relay wrapper and resumes close handshake', () => {
  const source = read('webserver.js');
  const declaration = 'function PerformWSRelayAuth(ws, req, noAuthOk, func)';
  const wrapper = extractFunction(source, declaration);
  const socket = {
    sent: [], closeCount: 0, resumed: 0,
    send(value) { this.sent.push(JSON.parse(value)); },
    close() { this.closeCount++; },
    _socket: { resume() { socket.resumed++; } }
  };
  let destinationCalls = 0;
  const context = vm.createContext({
    parent: { debug: () => {} },
    obj: { force2factorPending: () => true },
    PerformWSSessionAuth: (_ws, _req, _noAuthOk, callback) =>
      callback(socket, { clientIp: '127.0.0.1' }, { id: 'domain' }, { _id: 'user/domain/alice' }, null, null)
  });
  vm.runInContext(`${wrapper}; globalThis.__tested = PerformWSRelayAuth;`, context, { timeout: 1000 });
  context.__tested({}, {}, false, () => { destinationCalls++; });
  assert.deepEqual(socket.sent, [{ action: 'close', cause: 'noauth', msg: '2farequired' }]);
  assert.equal(socket.closeCount, 1);
  assert.equal(socket.resumed, 1, 'paused relay socket is resumed so the denial can complete');
  assert.equal(destinationCalls, 0, 'pending-2FA user must not enter a relay handler');
});

test('force2factorPending uses the actual required-factor, completion, and skip-IP conditions', () => {
  const source = read('webserver.js');
  const declaration = 'obj.force2factorPending = function (domain, user, req)';
  const implementation = extractFunction(source, declaration);
  let factorConfigured = false, skipIp = false;
  const server = {
    args: {},
    parent: { certificates: { CommonName: 'mesh.example.test' } }
  };
  const context = vm.createContext({
    obj: server,
    parent: { config: { settings: {} } },
    userHasSecondFactor: () => factorConfigured,
    require: () => ({ match: () => skipIp })
  });
  vm.runInContext(`${implementation};`, context, { timeout: 1000 });
  const user = { _id: 'user/domain/alice' };
  const domain = { passwordrequirements: { force2factor: true } };
  assert.equal(server.force2factorPending(domain, user, {}), true, 'required and unconfigured 2FA is pending');
  factorConfigured = true;
  assert.equal(server.force2factorPending(domain, user, {}), false, 'configured factor satisfies the requirement');
  factorConfigured = false;
  skipIp = true;
  assert.equal(server.force2factorPending({ ...domain, passwordrequirements: { force2factor: true, skip2factor: ['127.0.0.1'] } }, user, { clientIp: '127.0.0.1' }), false, 'configured skip ranges preserve their existing behavior');
});

test('interactive relay entry routes use the pending-2FA wrapper', () => {
  const source = read('webserver.js');
  assert.match(source, /obj\.app\.ws\(url \+ 'webrelay\.ashx',[\s\S]{0,180}PerformWSRelayAuth\(ws, req, false, handleRelayWebSocket\)/,
    'the standard web relay entry is wrapped');
  assert.match(source, /obj\.app\.ws\(url \+ 'meshrelay\.ashx',[\s\S]{0,180}PerformWSRelayAuth\(ws, req, true,/,
    'the standard mesh relay entry, including resume and no-auth relay flows, is wrapped');
  assert.match(source, /obj\.agentapp\.ws\(url \+ 'meshrelay\.ashx',[\s\S]{0,180}PerformWSRelayAuth\(ws, req, true,/,
    'the alternate agent-only-port relay entry is also wrapped');
});

test('completed 2FA setup continues through the websocket relay wrapper', () => {
  const source = read('webserver.js');
  const declaration = 'function PerformWSRelayAuth(ws, req, noAuthOk, func)';
  const wrapper = extractFunction(source, declaration);
  const context = vm.createContext({
    parent: { debug: () => {} },
    obj: { force2factorPending: () => false },
    PerformWSSessionAuth: (_ws, _req, _noAuthOk, callback) => callback('ws', 'req', 'domain', 'user', 'cookie', 'auth')
  });
  vm.runInContext(`${wrapper}; globalThis.__tested = PerformWSRelayAuth;`, context, { timeout: 1000 });
  let forwarded;
  context.__tested({}, {}, false, (...args) => { forwarded = args; });
  assert.deepEqual(Array.from(forwarded), ['ws', 'req', 'domain', 'user', 'cookie', 'auth']);
});

test('relay rights helper distinguishes browser RDP from TCP-routed protocol 10', () => {
  const source = read('meshrelay.js');
  const declaration = 'function isProtocolAllowedByRights(rights, protocol, tcpRouted)';
  const helper = extractFunction(source, declaration);
  const context = vm.createContext({
    MESHRIGHT_NOTERMINAL: 512,
    MESHRIGHT_NODESKTOP: 65536,
    MESHRIGHT_NOREGISTRY: 0x00400000,
    MESHRIGHT_NOFILES: 1024,
    MESHRIGHT_ADMIN: 0xFFFFFFFF
  });
  vm.runInContext(`${helper}; globalThis.__tested = isProtocolAllowedByRights;`, context, { timeout: 1000 });
  assert.equal(context.__tested(8 | 1024, 10, false), false, 'Browser RDP file protocol is denied without file rights');
  assert.equal(context.__tested(8 | 1024, 10, true), true, 'TCP routed protocol 10 is governed by the route rights');
  assert.equal(context.__tested(8, 5, false), true, 'a user with file rights can use the Files protocol');
  assert.equal(context.__tested(0xFFFFFFFF, 5, false), true, 'administrator rights retain access');
});

test('server command routing enforces required and prohibited rights on local and peer agents', () => {
  const source = read('meshuser.js');
  const declaration = 'function routeCommandToNode(command, requiredRights, requiredNonRights, func, options)';
  const implementation = extractFunction(source, declaration);
  function route(rights, remote) {
    const sent = [], outcomes = [];
    const node = { _id: 'node/domain/device', meshid: 'mesh/domain/group', consent: 0 };
    const agent = { dbNodeKey: node._id, dbMeshKey: node.meshid, send: value => sent.push(JSON.parse(value)) };
    const dispatched = [];
    const server = {
      wsagents: remote ? {} : { [node._id]: agent },
      meshes: { [node.meshid]: { _id: node.meshid, consent: 0 } },
      userGroups: {},
      GetNodeWithRights: (_domain, _user, _nodeid, callback) => callback(node, rights, true),
      parent: {
        GetRoutingServerIdNotSelf: () => remote ? { meshid: node.meshid, serverid: 'peer-a' } : null,
        multiServer: { DispatchMessageSingleServer: (message, serverid) => dispatched.push({ message: { ...message }, serverid }) }
      }
    };
    const context = vm.createContext({
      common: { validateString: value => typeof value === 'string' && value.length >= 8 },
      parent: server,
      domain: { id: 'domain' },
      user: { _id: 'user/domain/alice', name: 'alice', realname: 'Alice' },
      ws: { sessionId: 'session-1' },
      req: { clientIp: '127.0.0.1' },
      MESHRIGHT_REMOTECONTROL: 8,
      MESHRIGHT_REMOTEVIEWONLY: 256,
      MESHRIGHT_ADMIN: 0xFFFFFFFF
    });
    vm.runInContext(`${implementation}; globalThis.__tested = routeCommandToNode;`, context, { timeout: 1000 });
    const result = context.__tested({ action: 'msg', nodeid: node._id }, 8, 256, value => outcomes.push(value));
    return { sent, dispatched, outcomes, result };
  }

  for (const remote of [false, true]) {
    const denied = route(8 | 256, remote);
    assert.deepEqual(denied.outcomes, [false], 'remote-view-only rights cannot route a modifying command');
    assert.equal(denied.sent.length + denied.dispatched.length, 0, 'denied command never reaches local or peer agent');
    const allowed = route(8, remote);
    assert.deepEqual(allowed.outcomes, [true]);
    assert.equal(allowed.sent.length + allowed.dispatched.length, 1, 'valid remote-control command routes once');
    const admin = route(0xFFFFFFFF, remote);
    assert.deepEqual(admin.outcomes, [true], 'administrator bypasses restriction bits');
    assert.equal(admin.sent.length + admin.dispatched.length, 1);
  }
});

test('Agent service-stop handler rejects view-only commands and permits control/admin with stamped rights', () => {
  const source = read('agents/meshcore.js');
  const rightsHelper = extractFunction(source, 'function server_hasControlRights(data)');
  const serviceStopCase = extractFunction(source, "case 'serviceStop':");
  function dispatch(rights) {
    let stopped = 0, lookedUp = 0;
    const context = vm.createContext({
      MESHRIGHT_REMOTECONTROL: 8,
      MESHRIGHT_REMOTEVIEW: 256,
      MESHRIGHT_ADMIN: 0xFFFFFFFF,
      MESHRIGHT_CHATNOTIFY: 16384,
      server_hasControlRights: undefined,
      process: { platform: 'linux' },
      console: { log: () => {} },
      MeshServerLogEx: () => {},
      sendConsoleText: () => {},
      require: name => {
        assert.equal(name, 'service-manager', 'denied control must stop before touching the service manager');
        lookedUp++;
        return { manager: { getService: () => ({ stop: () => { stopped++; } }) } };
      }
    });
    vm.runInContext(`${rightsHelper}; function handleServerCommand(data) { switch (data.type) { ${serviceStopCase} } }; globalThis.__tested = handleServerCommand;`, context, { timeout: 1000 });
    context.__tested({ action: 'msg', type: 'serviceStop', serviceName: 'fixture', rights });
    return { stopped, lookedUp };
  }
  assert.deepEqual(dispatch(8 | 256), { stopped: 0, lookedUp: 0 }, 'view-only user cannot stop a service');
  assert.deepEqual(dispatch(undefined), { stopped: 0, lookedUp: 0 }, 'missing stamped rights fail closed');
  assert.deepEqual(dispatch(8), { stopped: 1, lookedUp: 1 }, 'remote-control right reaches the mocked service handler');
  assert.deepEqual(dispatch(0xFFFFFFFF), { stopped: 1, lookedUp: 1 }, 'administrator right reaches the mocked service handler');
});

test('Agent mutating command guards deny view-only or missing rights and permit control/admin', () => {
  const source = read('agents/meshcore.js');
  const rightsHelper = extractFunction(source, 'function server_hasControlRights(data)');
  const actionNames = ['pskill', 'serviceStart', 'serviceRestart', 'deskBackground', 'openUrl', 'setclip'];
  const cases = actionNames.map(name => extractFunction(source, `case '${name}':`)).join('\n');

  function dispatch(type, rights) {
    const effects = Object.fromEntries(actionNames.map(name => [name, 0]));
    const requireCalls = [];
    const modules = {
      'service-manager': { manager: { getService: () => ({
        start: () => effects.serviceStart++, restart: () => effects.serviceRestart++
      }) } },
      MeshAgent: { isService: false, _wallpaper: 'fixture-wallpaper' },
      'user-sessions': { consoleUid: () => 1 },
      'linux-gnome-helpers': {
        getDesktopWallpaper: () => '/dev/null',
        setDesktopWallpaper: () => effects.deskBackground++
      },
      clipboard: value => { assert.equal(value, 'fixture clipboard'); effects.setclip++; }
    };
    const context = vm.createContext({
      MESHRIGHT_REMOTECONTROL: 8, MESHRIGHT_REMOTEVIEW: 256, MESHRIGHT_ADMIN: 0xFFFFFFFF,
      process: { platform: 'linux', kill: pid => { assert.equal(pid, 123); effects.pskill++; } },
      pendingSetClip: false,
      mesh: { SendCommand: () => {} },
      MeshServerLogEx: () => {}, sendConsoleText: () => {},
      openUserDesktopUrl: url => { assert.equal(url, 'https://fixture.test'); effects.openUrl++; return {}; },
      require: name => { requireCalls.push(name); assert.ok(modules[name], `unexpected module access: ${name}`); return modules[name]; }
    });
    vm.runInContext(`${rightsHelper}; function dispatch(data) { switch (data.type) { ${cases} } }; globalThis.__tested = dispatch;`, context, { timeout: 1000 });
    context.__tested({ type, rights, value: '123|fixture', serviceName: 'fixture', url: 'https://fixture.test', data: 'fixture clipboard' });
    return { effects, requireCalls };
  }

  for (const type of actionNames) {
    for (const rights of [8 | 256, undefined]) {
      const denied = dispatch(type, rights);
      assert.equal(denied.effects[type], 0, `${type} must have no side effect for view-only or missing rights`);
      assert.deepEqual(denied.requireCalls, [], `${type} must be denied before loading its action module`);
    }
    for (const rights of [8, 0xFFFFFFFF]) {
      const allowed = dispatch(type, rights);
      assert.equal(allowed.effects[type], 1, `${type} reaches its mocked action with remote-control or administrator rights`);
    }
  }
});
