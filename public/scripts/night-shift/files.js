/* Native file workspace enhancements: local filter and selection inspector. */
(function () {
  'use strict';
  if (window.__NightShiftFiles) return;
  var $ = function (id) { return document.getElementById(id); };
  var search, inspector, detail, actions = [];
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
    update();
  }
  function boot() {
    build();
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
