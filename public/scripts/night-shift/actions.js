/* Permission-aware shortcuts into MeshCentral's audited native action dialog. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftActions) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, status, power, commands;
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function hasRights(rights, mask) { return typeof rights === 'number' && (rights & mask) !== 0; }
  function availability() {
    var node = window.currentNode;
    if (!node || typeof window.GetNodeRights !== 'function') return {power:false,commands:false};
    var rights = window.GetNodeRights(node), conn = Number(node.conn) || 0;
    if (node.agent && node.agent.id === 14) return {power:!!((conn & 1) && hasRights(rights,8)),commands:false};
    var canCommand = node.mtype === 2 && !!(conn & 1) && hasRights(rights,131072) && node.agent != null;
    var canPower = hasRights(rights,64) || (conn !== 0 && hasRights(rights,262144)) ||
      ((conn & 16) !== 0) || (hasRights(rights,32768) && (conn & 1) !== 0) ||
      (!!node.intelamt && node.intelamt.state === 2 && (conn & 6) !== 0 && (hasRights(rights,64) || hasRights(rights,262144)));
    return {power:canPower,commands:canCommand};
  }
  function update() {
    var host = $('p10'), anchor = $('p10info') || $('p10title');
    if (!host || !anchor) return;
    if (!panel) {
      panel = create('section','ns-native-actions'); panel.id = 'ns-native-actions';
      panel.setAttribute('aria-label','Native device actions');
      panel.append(create('h3','','Quick actions'));
      status = create('p','ns-native-actions-status','Actions are checked against current MeshCentral device permissions.');
      panel.append(status);
      var row = create('div','ns-native-actions-row');
      power = create('button','ns-native-action','Device actions'); power.type = 'button';
      power.addEventListener('click',function () { if (availability().power && typeof window.deviceActionFunction === 'function') window.deviceActionFunction(); });
      commands = create('button','ns-native-action','Run command'); commands.type = 'button';
      commands.addEventListener('click',function () { if (availability().commands && typeof window.runDeviceCmd === 'function') window.runDeviceCmd(); });
      row.append(power,commands); panel.append(row);
      if (anchor.parentNode === host) host.insertBefore(panel,anchor); else host.insertBefore(panel,host.firstChild);
    }
    var allowed = availability();
    power.disabled = !allowed.power;
    commands.disabled = !allowed.commands || typeof window.runDeviceCmd !== 'function';
    status.textContent = allowed.power || allowed.commands ?
      'Available actions open MeshCentral’s native confirmation and audit flow.' :
      'No power or command actions are available for this device with the current connection and permissions.';
  }
  function boot() {
    if (!$('p10')) return;
    update();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(update);
      ['p10info','p10title','p10html3','p10html5','MainComputerState'].forEach(function (id) {
        var target = $(id); if (target) observer.observe(target,{attributes:true,childList:true,subtree:true});
      });
    }
  }
  window.__NightShiftActions = {refresh:update};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
