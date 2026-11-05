/* Native file workspace enhancements: local filter and selection inspector. */
(function () {
  'use strict';
  if (window.__NightShiftFiles) return;
  var $ = function (id) { return document.getElementById(id); };
  var search, inspector, detail, actions = [];
  var uploadObserver, transferQueue, transferStatus, transferList, historyPanel, historyList, lastQueueIndex = null;
  var transferHistory = [], uploadTrackingInstalled = false, downloadTrackingInstalled = false;
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function size(bytes) {
    if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return 'Unavailable';
    var units = ['B','KB','MB','GB','TB'], i = 0, value = bytes;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
    return value.toFixed(i ? 1 : 0) + ' ' + units[i];
  }
  function filter() {
    var root = $('p13files'); if (!root || !search) return;
    var q = search.value.trim().toLocaleLowerCase();
    root.querySelectorAll('.filelist').forEach(function (entry) {
      entry.hidden = !!q && !(entry.textContent || '').toLocaleLowerCase().includes(q);
    });
  }
  function actionButton(container, id, label) {
    var native = $(id); if (!native) return;
    var button = create('button','ns-file-action',label); button.type = 'button';
    button.disabled = !!native.disabled;
    button.addEventListener('click', function () { if (!native.disabled && native.click) native.click(); });
    actions.push({ button:button, native:native });
    container.append(button);
  }
  function update() {
    filter();
    actions.forEach(function (item) { item.button.disabled = !item.native || !!item.native.disabled; });
    if (!inspector || !detail) return;
    var tree = window.p13filetree, selected = $('p13files') && $('p13files').querySelectorAll('input[name="fd"]:checked');
    detail.replaceChildren();
    if (!tree || !selected || !selected.length) {
      detail.append(create('p','ns-file-empty',tree ? 'Select a file to inspect its details.' : 'Connect to a device to browse files.'));
      return;
    }
    detail.append(create('strong','ns-file-selection-count',selected.length + (selected.length === 1 ? ' item selected' : ' items selected')));
    if (selected.length !== 1) {
      detail.append(create('p','ns-file-empty','Select one item to view its name, type, size and modified time.'));
      return;
    }
    var item = tree.dir && tree.dir[selected[0].value];
    if (!item) { detail.append(create('p','ns-file-empty','Details are unavailable for this item.')); return; }
    detail.append(create('h4','ns-file-name',item.n || 'Unnamed item'));
    detail.append(create('div','ns-file-meta',(item.t < 3 ? 'Folder' : 'File')));
    detail.append(create('div','ns-file-meta','Size: ' + (item.t < 3 ? '—' : size(item.s))));
    detail.append(create('div','ns-file-meta','Modified: ' + (item.d ? new Date(typeof item.d === 'number' ? item.d * 1000 : item.d).toLocaleString() : 'Unavailable')));
  }
  function updateUploadQueue() {
    var upload = window.uploadFile;
    if (!upload || !upload.xfiles || typeof upload.xfiles.length !== 'number' || !upload.xfiles.length) {
      if (transferQueue) transferQueue.remove();
      transferQueue = transferStatus = transferList = null;
      lastQueueIndex = null;
      return;
    }
    var body = $('xxAddAgentBody') || (document.querySelector && document.querySelector('#xxAddAgentModal .modal-body'));
    var progress = $('d2progressLabel');
    if (!body || !progress) return;
    if (!transferQueue) {
      transferQueue = create('section','ns-transfer-queue');
      transferQueue.setAttribute('aria-label','Upload queue');
      transferStatus = create('p','ns-transfer-status');
      transferStatus.setAttribute('aria-live','polite');
      transferStatus.setAttribute('aria-atomic','true');
      transferList = create('ol','ns-transfer-list');
      transferQueue.append(transferStatus,transferList);
      progress.insertAdjacentElement('afterend',transferQueue);
    }
    var index = Math.max(0, Math.min(upload.xfiles.length - 1, Number(upload.xfilePtr) || 0));
    var current = upload.xfiles[index];
    var nativeName = $('p13dfileName');
    var name = nativeName && nativeName.textContent || (current && current.name) || 'Current file';
    var percent = $('d2progressBar');
    var progressText = $('d2progressLabel');
    var amount = percent && Number(percent.max) > 0 ? Math.floor((Number(percent.value) / Number(percent.max)) * 100) : null;
    var state = progressText && progressText.textContent || '';
    var currentProgress = amount === null ? state : Math.max(0,Math.min(100,amount)) + '%';
    var statusText = 'File ' + (index + 1) + ' of ' + upload.xfiles.length + ': ' + name + ' · ' + currentProgress;
    if (transferStatus.textContent !== statusText) transferStatus.textContent = statusText;
    if (lastQueueIndex !== index || transferList.childElementCount !== upload.xfiles.length) {
      transferList.replaceChildren();
      Array.prototype.forEach.call(upload.xfiles,function (file, fileIndex) {
        var item = create('li','ns-transfer-item');
        var fileName = create('span','ns-transfer-name',file && file.name || 'Unnamed file');
        var stateLabel = fileIndex < index ? 'Sent' : fileIndex === index ? 'Current' : 'Queued';
        item.append(fileName,create('span','ns-transfer-state',stateLabel));
        if (fileIndex === index) item.setAttribute('aria-current','true');
        transferList.append(item);
      });
      lastQueueIndex = index;
    }
  }
  function renderHistory() {
    if (!historyList) return;
    historyList.replaceChildren();
    if (!transferHistory.length) {
      historyList.append(create('li','ns-transfer-history-empty','Transfers started in this page will appear here.'));
      return;
    }
    transferHistory.forEach(function (entry) {
      var row = create('li','ns-transfer-history-item');
      var label = create('span','ns-transfer-history-name',entry.name);
      var state = create('span','ns-transfer-history-state',entry.state);
      row.append(label,state);
      if (entry.type === 'upload' && (entry.state === 'Failed' || entry.state === 'Failed to start') && entry.file) {
        var retry = create('button','ns-transfer-retry','Retry');
        retry.type = 'button'; retry.setAttribute('aria-label','Retry upload of ' + entry.name);
        retry.addEventListener('click',function () {
          var upload = $('p13UploadButton');
          if (!upload || upload.disabled || typeof window.p13doUploadFiles !== 'function') return;
          entry.state = 'Queued'; renderHistory();
          try { window.p13doUploadFiles([entry.file]); }
          catch (error) { entry.state = 'Failed to start'; renderHistory(); }
        });
        row.append(retry);
      } else if (entry.type === 'download' && entry.path) {
        var again = create('button','ns-transfer-retry','Download again');
        again.type = 'button'; again.setAttribute('aria-label','Download ' + entry.name + ' again');
        again.addEventListener('click',function () {
          var download = $('p13DownloadButton'), node = window.currentNode;
          if (!download || download.disabled || !node || node._id !== entry.nodeId || typeof window.p13downloadDeviceFile !== 'function') return;
          entry.state = 'Requested again'; renderHistory();
          window.p13downloadDeviceFile(entry.path);
        });
        row.append(again);
      }
      historyList.append(row);
    });
  }
  function recordUpload(file,state) {
    if (!file) return;
    var entry = transferHistory.find(function (item) { return item.file === file; });
    if (!entry) {
      entry = { type:'upload', name:file.name || 'Unnamed file', file:file, state:state };
      transferHistory.unshift(entry);
      transferHistory = transferHistory.slice(0,20);
    } else entry.state = state;
    renderHistory();
  }
  function watchNativeUploadResults() {
    if (uploadTrackingInstalled || typeof window.p13gotUploadData !== 'function') return;
    var nativeHandler = window.p13gotUploadData;
    window.p13gotUploadData = function (message) {
      var upload = window.uploadFile;
      var file = upload && upload.xfiles && upload.xfiles[upload.xfilePtr];
      var action = message && message.action;
      var result = nativeHandler.apply(this,arguments);
      if (action === 'uploadstart') recordUpload(file,'In progress');
      else if (action === 'uploaddone') recordUpload(file,'Completed');
      else if (action === 'uploaderror') recordUpload(file,'Failed');
      return result;
    };
    uploadTrackingInstalled = true;
  }
  function watchNativeDownloads() {
    if (downloadTrackingInstalled || typeof window.p13downloadDeviceFile !== 'function') return;
    var nativeDownload = window.p13downloadDeviceFile;
    window.p13downloadDeviceFile = function (path) {
      var decoded = path;
      try { decoded = decodeURIComponent(path); } catch (error) { /* Keep the native path as displayed text. */ }
      var name = String(decoded || '').split(/[\\/]/).pop() || 'Device file';
      var node = window.currentNode;
      var entry = {type:'download',name:name,path:path,nodeId:node && node._id,state:'Requested'};
      transferHistory.unshift(entry);
      transferHistory = transferHistory.slice(0,20);
      renderHistory();
      try { return nativeDownload.apply(this,arguments); }
      catch (error) { entry.state = 'Failed to start'; renderHistory(); return false; }
    };
    downloadTrackingInstalled = true;
  }
  function watchUploadQueue() {
    var body = $('xxAddAgentBody') || (document.querySelector && document.querySelector('#xxAddAgentModal .modal-body'));
    if (!body || typeof MutationObserver !== 'function' || uploadObserver) return;
    uploadObserver = new MutationObserver(updateUploadQueue);
    uploadObserver.observe(body,{childList:true,subtree:true,characterData:true});
    var modal = $('xxAddAgentModal');
    if (modal) uploadObserver.observe(modal,{attributes:true,attributeFilter:['class','aria-hidden']});
    updateUploadQueue();
  }
  function build() {
    var page = $('p13'), title = $('p13title'), list = $('p13filetable');
    if (!page || !title || !list) return;
    if (!search) {
      var label = create('label','ns-file-search'); label.append(create('span','','Filter current folder'));
      search = create('input','form-control form-control-sm'); search.type = 'search';
      search.setAttribute('aria-label','Filter current folder'); search.setAttribute('placeholder','Name or type');
      search.addEventListener('input',update); label.append(search); title.append(label);
    }
    if (!inspector) {
      inspector = create('aside','ns-file-inspector'); inspector.setAttribute('aria-label','File selection details');
      inspector.append(create('h3','','Selection details'));
      detail = create('div','ns-file-inspector-content'); inspector.append(detail);
      var actions = create('div','ns-file-actions');
      actionButton(actions,'p13DownloadButton','Download'); actionButton(actions,'p13RenameFileButton','Rename');
      actionButton(actions,'p13DeleteFileButton','Delete'); inspector.append(actions);
      list.classList.add('ns-file-layout'); list.append(inspector);
    }
    if (!historyPanel) {
      historyPanel = create('section','ns-transfer-history');
      historyPanel.setAttribute('aria-label','Recent transfers');
      historyPanel.append(create('h3','','Recent transfers'));
      historyList = create('ol','ns-transfer-history-list');
      historyPanel.append(historyList);
      list.append(historyPanel);
      renderHistory();
    }
    update();
  }
  function boot() {
    build();
    watchUploadQueue();
    watchNativeUploadResults();
    watchNativeDownloads();
    var dropTarget = $('p13filetable');
    if (dropTarget) {
      dropTarget.addEventListener('dragover',function (event) {
        var upload = $('p13UploadButton');
        if (event.dataTransfer && event.dataTransfer.types && Array.prototype.indexOf.call(event.dataTransfer.types,'Files') >= 0 && upload && !upload.disabled) {
          event.preventDefault(); dropTarget.classList.add('ns-file-drop-active');
        }
      });
      dropTarget.addEventListener('dragleave',function (event) {
        if (!event.relatedTarget || !dropTarget.contains(event.relatedTarget)) dropTarget.classList.remove('ns-file-drop-active');
      });
      dropTarget.addEventListener('drop',function (event) {
        dropTarget.classList.remove('ns-file-drop-active');
        var upload = $('p13UploadButton'), dropped = event.dataTransfer && event.dataTransfer.files;
        if (!upload || upload.disabled || !dropped || !dropped.length || typeof window.p13doUploadFiles !== 'function') return;
        event.preventDefault();
        window.p13doUploadFiles(dropped);
      });
    }
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(build);
      var target = $('p13files');
      if (target) observer.observe(target,{childList:true,subtree:true});
    }
    if (document.addEventListener) document.addEventListener('change',function (event) { if (event.target && event.target.name === 'fd') update(); });
    if (window.addEventListener) window.addEventListener('resize',build,{passive:true});
  }
  window.__NightShiftFiles = { refresh:update };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
