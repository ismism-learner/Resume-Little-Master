/* ============================================================
   简历大师 — Application Logic
   ============================================================ */

(function () {
  'use strict';

  // ============================================================
  // 1. DATA MODEL
  // ============================================================
  let resumeData = {
    name: '',
    title: '',
    phone: '',
    email: '',
    address: '',
    workYears: '',
    expectedSalary: '',
    availability: '',
    photo: '',
    photoPosition: 'left',  // 'left' | 'right' | 'hidden'
    photoSize: 'large',    // 'small' | 'medium' | 'large'
    work: [
      { company: '', position: '', startDate: '', endDate: '', description: '' }
    ],
    education: [
      { school: '', major: '', degree: '', startDate: '', endDate: '' }
    ],
    skills: [],
    projects: [
      { name: '', role: '', description: '', link: '' }
    ],
    selfEvaluation: ''
  };

  /** Section order — controls both editor and preview rendering order */
  let sectionOrder = ['work', 'education', 'skills', 'projects', 'selfEvaluation'];

  /** Section labels for rendering */
  const sectionLabels = {
    work: '工作经历',
    education: '教育背景',
    skills: '技能特长',
    projects: '项目经历',
    selfEvaluation: '自我评价'
  };

  // ============================================================
  // 1b. TEMPLATE SYSTEM
  // ============================================================
  let currentTemplate = 'classic';

  const templateNames = {
    classic: '经典',
    modern: '现代',
    creative: '创意'
  };

  // ============================================================
  // 1b. RESUME MANAGER (Save / Load / Auto-save)
  // ============================================================

  var ResumeManager = {
    _dirty: false,
    _autosaveTimer: null,
    _currentSlot: null,

    _triggerRender: function() {
      renderDynamicSections();
      renderPreview();
    },

    _updateIndicator: function(text) {
      var el = $('#save-indicator');
      if (el) el.textContent = text;
    },

    _save: function(slotName) {
      var data = {
        version: 1,
        timestamp: Date.now(),
        template: currentTemplate,
        resumeData: JSON.parse(JSON.stringify(resumeData))
      };
      var key = 'resume_slot_' + slotName;
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        alert('保存失败：' + e.message);
      }
    },

    _load: function(slotName) {
      var key = 'resume_slot_' + slotName;
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },

    _remove: function(slotName) {
      localStorage.removeItem('resume_slot_' + slotName);
    },

    _listAll: function() {
      var slots = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.startsWith('resume_slot_')) {
          var slotName = key.slice('resume_slot_'.length);
          var raw = localStorage.getItem(key);
          try {
            var data = JSON.parse(raw);
            slots.push({
              name: slotName,
              timestamp: data.timestamp,
              template: data.template
            });
          } catch (e) {
            // corrupted entry
          }
        }
      }
      slots.sort(function(a, b) { return b.timestamp - a.timestamp; });
      return slots;
    },

    markDirty: function() {
      if (this._dirty) return;
      this._dirty = true;
      this._updateIndicator('未保存');
      if (this._autosaveTimer) clearTimeout(this._autosaveTimer);
      this._autosaveTimer = setTimeout(function() {
        ResumeManager.autosave();
      }, 2000);
    },

    autosave: function() {
      if (!this._dirty) return;
      this._dirty = false;
      if (this._currentSlot) {
        this._save(this._currentSlot);
        var now = new Date();
        var timeStr = now.getHours().toString().padStart(2, '0') + ':' +
                      now.getMinutes().toString().padStart(2, '0') + ':' +
                      now.getSeconds().toString().padStart(2, '0');
        this._updateIndicator('已自动保存 ' + timeStr);
      }
    },

    saveToSlot: function() {
      var input = $('#save-slot-name');
      var slotName = input ? input.value.trim() : '';
      if (!slotName) {
        slotName = '默认存档';
      }
      this._currentSlot = slotName;
      this._save(slotName);
      this._dirty = false;
      this._updateIndicator('已保存');
      this.listSlots();
    },

    saveToNewSlot: function() {
      var input = $('#save-slot-name');
      var baseName = input ? input.value.trim() : '默认存档';
      if (!baseName) baseName = '默认存档';
      var slots = this._listAll();
      var existingNames = {};
      for (var i = 0; i < slots.length; i++) {
        existingNames[slots[i].name] = true;
      }
      var suffix = 1;
      var slotName = baseName;
      while (existingNames[slotName]) {
        suffix++;
        slotName = baseName + ' (' + suffix + ')';
      }
      this._currentSlot = slotName;
      this._save(slotName);
      this._dirty = false;
      this._updateIndicator('已保存');
      if (input) input.value = slotName;
      this.listSlots();
    },

    loadFromSlot: function(slotName) {
      var data = this._load(slotName);
      if (!data) {
        alert('加载失败：存档数据不存在或已损坏');
        return;
      }
      resumeData = data.resumeData;
      currentTemplate = data.template || 'classic';
      this._currentSlot = slotName;
      this._dirty = false;
      this._updateIndicator('已加载');
      this._triggerRender();
      document.documentElement.style.setProperty('--selected-template', currentTemplate);
      if (typeof updateTemplateMenuState === 'function') {
        updateTemplateMenuState();
      }
      syncFontSettingsUI();
      this.listSlots();
      $('#save-dialog').close();
    },

    deleteSlot: function(slotName) {
      if (!confirm('确定要删除存档「' + slotName + '」吗？')) return;
      this._remove(slotName);
      if (this._currentSlot === slotName) {
        this._currentSlot = null;
        this._updateIndicator('尚未保存');
      }
      this.listSlots();
    },

    listSlots: function() {
      var container = $('#save-slot-list');
      if (!container) return;
      var slots = this._listAll();
      if (slots.length === 0) {
        container.innerHTML = '<div class="save-dialog__empty">暂无存档</div>';
        return;
      }
      var html = '';
      for (var i = 0; i < slots.length; i++) {
        var s = slots[i];
        var d = new Date(s.timestamp);
        var dateStr = d.getFullYear() + '-' +
                      (d.getMonth() + 1).toString().padStart(2, '0') + '-' +
                      d.getDate().toString().padStart(2, '0') + ' ' +
                      d.getHours().toString().padStart(2, '0') + ':' +
                      d.getMinutes().toString().padStart(2, '0');
        var templateName = templateNames[s.template] || s.template || '未知';
        var isActive = (s.name === this._currentSlot);
        html += '<div class="save-slot-item' + (isActive ? ' save-slot-item--active' : '') + '">' +
                  '<div class="save-slot-item__info">' +
                    '<div class="save-slot-item__name">' + esc(s.name) + '</div>' +
                    '<div class="save-slot-item__meta">' + dateStr + ' · ' + esc(templateName) + '</div>' +
                  '</div>' +
                  '<div class="save-slot-item__actions">' +
                    '<button class="save-slot-item__load btn btn--small btn--primary" data-slot="' + esc(s.name) + '">加载</button>' +
                    '<button class="save-slot-item__delete btn btn--small btn--outline" data-slot="' + esc(s.name) + '">删除</button>' +
                  '</div>' +
                '</div>';
      }
      container.innerHTML = html;
    },

    restoreAuto: function() {
      var slots = this._listAll();
      if (slots.length === 0) return false;
      var latest = slots[0];
      var data = this._load(latest.name);
      if (!data) return false;
      resumeData = data.resumeData;
      currentTemplate = data.template || 'classic';
      this._currentSlot = latest.name;
      this._dirty = false;
      var now = new Date();
      var timeStr = now.getHours().toString().padStart(2, '0') + ':' +
                    now.getMinutes().toString().padStart(2, '0') + ':' +
                    now.getSeconds().toString().padStart(2, '0');
      this._updateIndicator('已自动恢复 ' + timeStr);
      return true;
    }
  };

  // ============================================================
  // 2. DOM REFERENCES
  // ============================================================
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

  const a4Page = $('#a4-page');
  const editor = $('#editor');
  const preview = $('#preview');
  const previewCanvas = $('#preview-canvas');

  /** A4 page content height in pixels (measured at runtime) */
  let a4ContentHeightPx = 0;

  /** Convert mm to px based on screen DPI (1mm ≈ 3.779px) */
  function mmToPx(mm) {
    return mm * 3.779;
  }

  // ============================================================
  // 2b. ZOOM STATE
  // ============================================================

  let zoomMode = 'fit'; // 'fit' | 'actual' | 'manual'
  let manualZoom = 1.0;  // manual zoom scale (0.3 - 1.5)

  // ============================================================
  // 3. UTILITY FUNCTIONS
  // ============================================================

  /** Debounce — returns a function that delays invoking fn until after wait ms */
  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /** Escape HTML to prevent XSS */
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** Format a date string (YYYY-MM) to readable form */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;
    return parts[0] + '年' + parseInt(parts[1], 10) + '月';
  }

  /** Create placeholder span if value is empty */
  function ph(value, placeholder) {
    if (!value || !value.trim()) {
      return '<span class="placeholder">' + esc(placeholder) + '</span>';
    }
    return esc(value);
  }

  // ============================================================
  // 4. RENDER PREVIEW
  // ============================================================

  function renderPreview() {
    const d = resumeData;
    var pages = buildPages(d);
    buildPreviewDOM(pages);
    // Remove the old single a4-page if it still exists
    var oldPage = $('#a4-page');
    if (oldPage && oldPage.parentNode === previewCanvas && !oldPage.classList.contains('pages-container')) {
      oldPage.remove();
    }
    requestAnimationFrame(function() { scalePreview(); });
  }

  /**
   * Split the rendered HTML into block-level chunks for page layout.
   * Each chunk is a complete DOM node that should not be split across pages.
   * A section may span multiple pages, but individual entries (jobs, projects, etc.)
   * are never split.
   */
  function splitContentBlocks(contentHtml) {
    var div = document.createElement('div');
    div.innerHTML = contentHtml;
    var blocks = [];
    for (var ci = 0; ci < div.children.length; ci++) {
      var child = div.children[ci];
      if (child.classList.contains('resume__section')) {
        // Split section into: section-open (title) + [entry blocks...]
        var entries = [];
        var titleHtml = '';
        for (var si = 0; si < child.children.length; si++) {
          var secChild = child.children[si];
          if (secChild.classList.contains('resume__section-title')) {
            titleHtml = secChild.outerHTML;
          } else {
            entries.push({ html: secChild.outerHTML });
          }
        }

        // Section open block (includes section-open + title)
        blocks.push({
          type: 'section-open',
          html: '<div class="resume__section">' + titleHtml
        });

        // Each entry/skills-list as an individual block
        for (var ei = 0; ei < entries.length; ei++) {
          entries[ei].type = 'entry';
          blocks.push(entries[ei]);
        }
      } else {
        // Non-section top-level block (header, summary, photo, layout etc.)
        blocks.push({ type: 'generic', html: child.outerHTML });
      }
    }
    return blocks;
  }

  /**
   * Build page DOM structure by distributing blocks page-by-page.
   * Uses a hidden measurement container to find natural break points.
   */
  function buildPages(d) {
    var contentHtml = templates[currentTemplate](d);
    var blocks = splitContentBlocks(contentHtml);

    // Create measurement container
    var measurer = document.createElement('div');
    measurer.className = 'a4-page a4-page--measure';
    measurer.setAttribute('data-template', currentTemplate);
    measurer.style.fontFamily = d.fontFamily;
    measurer.style.fontSize = d.fontSizeBase + 'rem';
    measurer.style.lineHeight = d.lineHeight;
    document.body.appendChild(measurer);

    // Calculate content area threshold for page breaking
    // measurer.scrollHeight = padding-top + content-height
    // Available content area = 297mm - padding-top - padding-bottom
    // Page break when content exceeds: 297mm - padding-bottom (= scrollHeight > 297mm - bottom-padding)
    var measurerStyle = getComputedStyle(measurer);
    var paddingTopPx = parseFloat(measurerStyle.paddingTop) || mmToPx(16);
    var paddingBottomPx = parseFloat(measurerStyle.paddingBottom) || mmToPx(16);
    // scrollHeight threshold: content + padding-top must not exceed total height minus bottom padding
    a4ContentHeightPx = mmToPx(297) - paddingBottomPx;

    // Distribute blocks into pages
    var pages = [];
    var currentPage = [];

    for (var bi = 0; bi < blocks.length; bi++) {
      var block = blocks[bi];

      // Add block to current page
      currentPage.push(block);

      // Render current page to measure height
      measurer.innerHTML = renderBlocks(currentPage);
      var h = measurer.scrollHeight;

      if (h > a4ContentHeightPx && currentPage.length > 1) {
        // Remove the last block — it doesn't fit
        var overflowBlock = currentPage.pop();

        if (overflowBlock.type === 'section-open') {
          // section-open alone on new page is useless — keep it on current page
          currentPage.push(overflowBlock);
          pages.push(currentPage);
          currentPage = [];
        } else if (currentPage.length === 1 && currentPage[0].type === 'section-open') {
          // section-open with no entries yet — carry both to next page
          var secOpen = currentPage.pop();
          currentPage = [secOpen, overflowBlock];
        } else {
          pages.push(currentPage);
          currentPage = [overflowBlock];
        }
      }
    }

    // Push the last page
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    document.body.removeChild(measurer);
    return pages;
  }

  /**
   * Render a list of blocks back to an HTML string.
   * Produces valid, self-contained HTML for each page by auto-wrapping
   * orphan entries with section divs when a section spans pages.
   */
  function renderBlocks(blocks) {
    var html = '';
    var openSectionCount = 0;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.type === 'section-open') {
        html += b.html;
        openSectionCount++;
      } else {
        // If we encounter an entry block but no section is open,
        // auto-open a wrapper div to keep HTML valid
        if (openSectionCount === 0 && (b.type === 'entry' || b.html.indexOf('resume__entry') !== -1 || b.html.indexOf('resume__skills-list') !== -1)) {
          html += '<div class="resume__section">';
          openSectionCount++;
        }
        html += b.html;
      }
    }
    // Close any remaining open sections
    for (var j = 0; j < openSectionCount; j++) {
      html += '</div>';
    }
    return html;
  }

  /**
   * Build the DOM for all pages and insert into previewCanvas.
   */
  function buildPreviewDOM(pages) {
    var container = previewCanvas.querySelector('.pages-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'pages-container';
      previewCanvas.appendChild(container);
    }
    container.innerHTML = '';

    var d = resumeData;
    var numPages = pages.length;

    for (var pi = 0; pi < numPages; pi++) {
      var blocks = pages[pi];
      var page = document.createElement('div');
      page.className = 'a4-page';
      page.setAttribute('data-template', currentTemplate);
      page.setAttribute('data-page-number', (pi + 1) + ' / ' + numPages);
      page.style.fontFamily = d.fontFamily;
      page.style.fontSize = d.fontSizeBase + 'rem';
      page.style.lineHeight = d.lineHeight;

      // Build content for this page
      var content = document.createElement('div');
      content.className = 'a4-page__content';
      content.innerHTML = renderBlocks(blocks);
      page.appendChild(content);
      container.appendChild(page);
    }
  }

  // ============================================================
  // 4b. TEMPLATE RENDERERS
  // ============================================================

  const templates = {

    // --- CLASSIC TEMPLATE (original layout, preserved as-is) ---
    classic(d) {
      let html = '';
      var photoPos = d.photoPosition || 'left';
      var photoSz = d.photoSize || 'medium';
      var showPhoto = d.photo && photoPos !== 'hidden';

      // --- Header ---
      html += '<div class="resume__header' + (showPhoto ? ' resume__header--photo-' + photoPos : '') + '">';

      // Photo on left
      if (showPhoto && photoPos === 'left') {
        html += '<div class="resume__photo-wrap resume__photo-wrap--' + photoSz + '"><img src="' + d.photo + '" class="resume__photo" alt=""></div>';
      }

      html += '<div class="resume__header-text">';
      html += '  <div class="resume__name">' + ph(d.name, '张三') + '</div>';
      html += '  <div class="resume__title">' + ph(d.title, '前端工程师') + '</div>';

      // Contact line
      const contactItems = [];
      if (d.phone) contactItems.push(d.phone);
      if (d.email) contactItems.push(d.email);
      if (d.address) contactItems.push(d.address);
      if (d.workYears) contactItems.push(d.workYears + '经验');
      if (d.expectedSalary) contactItems.push('期望' + d.expectedSalary);
      if (d.availability) contactItems.push(d.availability);

      if (contactItems.length > 0) {
        html += '  <div class="resume__contact">';
        contactItems.forEach(item => {
          html += '<span class="resume__contact-item">' + esc(item) + '</span>';
        });
        html += '  </div>';
      } else {
        html += '  <div class="resume__contact">';
        html += '    <span class="resume__contact-item placeholder">138-0000-0000</span>';
        html += '    <span class="resume__contact-item placeholder">zhangsan@email.com</span>';
        html += '    <span class="resume__contact-item placeholder">北京市朝阳区</span>';
        html += '  </div>';
      }

      html += '</div>'; // resume__header-text

      // Photo on right
      if (showPhoto && photoPos === 'right') {
        html += '<div class="resume__photo-wrap resume__photo-wrap--' + photoSz + '"><img src="' + d.photo + '" class="resume__photo" alt=""></div>';
      }

      html += '</div>'; // resume__header

      // --- Sections in sectionOrder ---
      sectionOrder.forEach(sectionKey => {
        switch (sectionKey) {
          case 'work':
            html += renderWorkPreviewSection(d);
            break;
          case 'education':
            html += renderEducationPreviewSection(d);
            break;
          case 'skills':
            html += renderSkillsPreviewSection(d);
            break;
          case 'projects':
            html += renderProjectsPreviewSection(d);
            break;
          case 'selfEvaluation':
            html += renderSelfEvaluationSection(d);
            break;
        }
      });

      return html;
    },

    // --- MODERN TEMPLATE (two-column: sidebar + main) ---
    modern(d) {
      let sidebarHtml = '';
      let mainHtml = '';

      // --- SIDEBAR ---
      // Photo (if exists and not hidden)
      var modPhotoPos = d.photoPosition || 'left';
      var modPhotoSz = d.photoSize || 'medium';
      if (d.photo && modPhotoPos !== 'hidden') {
        sidebarHtml += '<div class="resume__sidebar-photo-wrap resume__sidebar-photo-wrap--' + modPhotoSz + '"><img src="' + d.photo + '" class="resume__sidebar-photo" alt=""></div>';
      }
      // Name & title
      sidebarHtml += '<div class="resume__sidebar-name">' + ph(d.name, '张三') + '</div>';
      sidebarHtml += '<div class="resume__sidebar-title">' + ph(d.title, '前端工程师') + '</div>';

      // Contact (stacked vertically)
      sidebarHtml += '<div class="resume__sidebar-contact">';
      if (d.phone) {
        sidebarHtml += '<span class="resume__sidebar-contact-item">' + esc(d.phone) + '</span>';
      }
      if (d.email) {
        sidebarHtml += '<span class="resume__sidebar-contact-item">' + esc(d.email) + '</span>';
      }
      if (d.address) {
        sidebarHtml += '<span class="resume__sidebar-contact-item">' + esc(d.address) + '</span>';
      }
      if (d.workYears) {
        sidebarHtml += '<span class="resume__sidebar-contact-item">' + esc(d.workYears) + '经验</span>';
      }
      if (d.expectedSalary) {
        sidebarHtml += '<span class="resume__sidebar-contact-item">期望' + esc(d.expectedSalary) + '</span>';
      }
      if (d.availability) {
        sidebarHtml += '<span class="resume__sidebar-contact-item">' + esc(d.availability) + '</span>';
      }
      if (!d.phone && !d.email && !d.address && !d.workYears && !d.expectedSalary && !d.availability) {
        sidebarHtml += '<span class="resume__sidebar-contact-item placeholder">138-0000-0000</span>';
        sidebarHtml += '<span class="resume__sidebar-contact-item placeholder">zhangsan@email.com</span>';
        sidebarHtml += '<span class="resume__sidebar-contact-item placeholder">北京市朝阳区</span>';
      }
      sidebarHtml += '</div>';

      // --- MAIN CONTENT ---
      // Sections in sectionOrder — route to sidebar or main
      sectionOrder.forEach(sectionKey => {
        switch (sectionKey) {
          case 'skills':
            sidebarHtml += renderModernSkillsSection(d);
            break;
          case 'education':
            sidebarHtml += renderModernEducationSection(d);
            break;
          case 'work':
            mainHtml += renderModernWorkSection(d);
            break;
          case 'projects':
            mainHtml += renderModernProjectsSection(d);
            break;
          case 'selfEvaluation':
            mainHtml += renderSelfEvaluationSection(d);
            break;
        }
      });

      // Assemble two-column layout
      let html = '<div class="resume__layout">';
      html += '<div class="resume__sidebar">' + sidebarHtml + '</div>';
      html += '<div class="resume__main">' + mainHtml + '</div>';
      html += '</div>';

      return html;
    },

    // --- CREATIVE TEMPLATE (bold single-column) ---
    creative(d) {
      let html = '';

      // --- Header: name + title on same line ---
      html += '<div class="resume__creative-header">';
      html += '  <div class="resume__creative-name-line">';
      var crPhotoPos = d.photoPosition || 'left';
      var crPhotoSz = d.photoSize || 'medium';
      if (d.photo && crPhotoPos !== 'hidden') {
        html += '<div class="resume__creative-photo-wrap resume__creative-photo-wrap--' + crPhotoSz + '"><img src="' + d.photo + '" class="resume__creative-photo" alt=""></div>';
      }
      html += '    <span class="resume__creative-name">' + ph(d.name, '张三') + '</span>';
      html += '    <span class="resume__creative-title">' + ph(d.title, '前端工程师') + '</span>';
      html += '  </div>';

      // Contact bar with background
      html += '  <div class="resume__creative-contact">';
      const contactItems = [];
      if (d.phone) contactItems.push(d.phone);
      if (d.email) contactItems.push(d.email);
      if (d.address) contactItems.push(d.address);
      if (d.workYears) contactItems.push(d.workYears + '经验');
      if (d.expectedSalary) contactItems.push('期望' + d.expectedSalary);
      if (d.availability) contactItems.push(d.availability);

      if (contactItems.length > 0) {
        contactItems.forEach(item => {
          html += '<span class="resume__creative-contact-item">' + esc(item) + '</span>';
        });
      } else {
        html += '<span class="resume__creative-contact-item placeholder">138-0000-0000</span>';
        html += '<span class="resume__creative-contact-item placeholder">zhangsan@email.com</span>';
        html += '<span class="resume__creative-contact-item placeholder">北京市朝阳区</span>';
      }
      html += '  </div>';
      html += '</div>';

      // --- Sections in sectionOrder ---
      sectionOrder.forEach(sectionKey => {
        switch (sectionKey) {
          case 'work':
            html += renderCreativeWorkSection(d);
            break;
          case 'education':
            html += renderCreativeEducationSection(d);
            break;
          case 'skills':
            html += renderCreativeSkillsSection(d);
            break;
          case 'projects':
            html += renderCreativeProjectsSection(d);
            break;
          case 'selfEvaluation':
            html += renderSelfEvaluationSection(d);
            break;
        }
      });

      return html;
    }
  };

  /** Format description text — convert newlines to bullet list if multi-line */
  function formatDescription(text) {
    if (!text) return '';
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length <= 1) {
      return esc(text);
    }
    let html = '<ul>';
    lines.forEach(line => {
      // Strip leading bullet characters if present
      const cleaned = line.replace(/^[-•·]\s*/, '').trim();
      if (cleaned) {
        html += '<li>' + esc(cleaned) + '</li>';
      }
    });
    html += '</ul>';
    return html;
  }

  // Debounced version for input events
  const debouncedRender = debounce(renderPreview, 150);

  // ============================================================
  // 4c. PREVIEW SECTION HELPERS (used by all templates)
  // ============================================================

  function renderWorkPreviewSection(d) {
    if (d.work.length === 0) return '';
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">工作经历</div>';
    d.work.forEach(w => {
      const hasContent = w.company || w.position || w.description;
      if (!hasContent && d.work.length === 1) {
        html += '<div class="resume__entry">';
        html += '  <div class="resume__entry-header">';
        html += '    <span class="resume__entry-title placeholder">某某科技有限公司</span>';
        html += '    <span class="resume__entry-date placeholder">2020.06 — 至今</span>';
        html += '  </div>';
        html += '  <div class="resume__entry-subtitle placeholder">高级前端工程师</div>';
        html += '  <div class="resume__entry-desc placeholder">负责公司核心产品的前端架构设计与开发工作</div>';
        html += '</div>';
        return;
      }
      if (!hasContent) return;

      html += '<div class="resume__entry">';
      html += '  <div class="resume__entry-header">';
      html += '    <span class="resume__entry-title">' + ph(w.company, '公司名称') + '</span>';
      const dateRange = (w.startDate || w.endDate)
        ? formatDate(w.startDate) + ' — ' + (formatDate(w.endDate) || '至今')
        : '';
      if (dateRange) {
        html += '    <span class="resume__entry-date">' + esc(dateRange) + '</span>';
      }
      html += '  </div>';
      if (w.position) {
        html += '  <div class="resume__entry-subtitle">' + esc(w.position) + '</div>';
      }
      if (w.description) {
        html += '  <div class="resume__entry-desc">' + formatDescription(w.description) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderEducationPreviewSection(d) {
    if (d.education.length === 0) return '';
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">教育背景</div>';
    d.education.forEach(e => {
      const hasContent = e.school || e.major || e.degree;
      if (!hasContent && d.education.length === 1) {
        html += '<div class="resume__entry">';
        html += '  <div class="resume__entry-header">';
        html += '    <span class="resume__entry-title placeholder">北京大学</span>';
        html += '    <span class="resume__entry-date placeholder">2016.09 — 2020.06</span>';
        html += '  </div>';
        html += '  <div class="resume__entry-subtitle placeholder">计算机科学与技术 · 本科</div>';
        html += '</div>';
        return;
      }
      if (!hasContent) return;

      html += '<div class="resume__entry">';
      html += '  <div class="resume__entry-header">';
      html += '    <span class="resume__entry-title">' + ph(e.school, '学校名称') + '</span>';
      const dateRange = (e.startDate || e.endDate)
        ? formatDate(e.startDate) + ' — ' + formatDate(e.endDate)
        : '';
      if (dateRange) {
        html += '    <span class="resume__entry-date">' + esc(dateRange) + '</span>';
      }
      html += '  </div>';
      const eduDetail = [e.major, e.degree].filter(Boolean).join(' · ');
      if (eduDetail) {
        html += '  <div class="resume__entry-subtitle">' + esc(eduDetail) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderSkillsPreviewSection(d) {
    if (d.skills.length === 0) return '';
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">技能特长</div>';
    html += '  <div class="resume__skills-list">';
    d.skills.forEach(skill => {
      html += '<span class="resume__skill-tag">' + esc(skill) + '</span>';
    });
    html += '  </div>';
    html += '</div>';
    return html;
  }

  function renderProjectsPreviewSection(d) {
    if (d.projects.length === 0) return '';
    // Check if all projects are empty
    const hasAnyContent = d.projects.some(p => p.name || p.role || p.description);
    if (!hasAnyContent) return '';
    
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">项目经历</div>';
    d.projects.forEach(p => {
      const hasContent = p.name || p.role || p.description;
      if (!hasContent) return;

      html += '<div class="resume__entry">';
      html += '  <div class="resume__entry-header">';
      html += '    <span class="resume__entry-title">' + ph(p.name, '项目名称') + '</span>';
      if (p.link) {
        html += '    <a class="resume__project-link" href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.link) + '</a>';
      }
      html += '  </div>';
      if (p.role) {
        html += '  <div class="resume__entry-subtitle">' + esc(p.role) + '</div>';
      }
      if (p.description) {
        html += '  <div class="resume__entry-desc">' + formatDescription(p.description) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderSelfEvaluationSection(d) {
    if (!d.selfEvaluation) return '';
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">自我评价</div>';
    html += '  <div class="resume__summary">' + esc(d.selfEvaluation) + '</div>';
    html += '</div>';
    return html;
  }

  // --- Modern template section helpers ---

  function renderModernSkillsSection(d) {
    if (d.skills.length === 0) return '';
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">技能特长</div>';
    html += '  <div class="resume__skills-list">';
    d.skills.forEach(skill => {
      html += '<span class="resume__skill-tag">' + esc(skill) + '</span>';
    });
    html += '  </div>';
    html += '</div>';
    return html;
  }

  function renderModernEducationSection(d) {
    if (d.education.length === 0) return '';
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">教育背景</div>';
    d.education.forEach(e => {
      const hasContent = e.school || e.major || e.degree;
      if (!hasContent && d.education.length === 1) {
        html += '<div class="resume__entry">';
        html += '  <div class="resume__entry-header">';
        html += '    <span class="resume__entry-title placeholder">北京大学</span>';
        html += '    <span class="resume__entry-date placeholder">2016.09 — 2020.06</span>';
        html += '  </div>';
        html += '  <div class="resume__entry-subtitle placeholder">计算机科学与技术 · 本科</div>';
        html += '</div>';
        return;
      }
      if (!hasContent) return;

      html += '<div class="resume__entry">';
      html += '  <div class="resume__entry-header">';
      html += '    <span class="resume__entry-title">' + ph(e.school, '学校名称') + '</span>';
      const dateRange = (e.startDate || e.endDate)
        ? formatDate(e.startDate) + ' — ' + formatDate(e.endDate)
        : '';
      if (dateRange) {
        html += '    <span class="resume__entry-date">' + esc(dateRange) + '</span>';
      }
      html += '  </div>';
      const eduDetail = [e.major, e.degree].filter(Boolean).join(' · ');
      if (eduDetail) {
        html += '  <div class="resume__entry-subtitle">' + esc(eduDetail) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderModernWorkSection(d) {
    if (d.work.length === 0) return '';
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">工作经历</div>';
    d.work.forEach(w => {
      const hasContent = w.company || w.position || w.description;
      if (!hasContent && d.work.length === 1) {
        html += '<div class="resume__entry">';
        html += '  <div class="resume__entry-header">';
        html += '    <span class="resume__entry-title placeholder">某某科技有限公司</span>';
        html += '    <span class="resume__entry-date placeholder">2020.06 — 至今</span>';
        html += '  </div>';
        html += '  <div class="resume__entry-subtitle placeholder">高级前端工程师</div>';
        html += '  <div class="resume__entry-desc placeholder">负责公司核心产品的前端架构设计与开发工作</div>';
        html += '</div>';
        return;
      }
      if (!hasContent) return;

      html += '<div class="resume__entry">';
      html += '  <div class="resume__entry-header">';
      html += '    <span class="resume__entry-title">' + ph(w.company, '公司名称') + '</span>';
      const dateRange = (w.startDate || w.endDate)
        ? formatDate(w.startDate) + ' — ' + (formatDate(w.endDate) || '至今')
        : '';
      if (dateRange) {
        html += '    <span class="resume__entry-date">' + esc(dateRange) + '</span>';
      }
      html += '  </div>';
      if (w.position) {
        html += '  <div class="resume__entry-subtitle">' + esc(w.position) + '</div>';
      }
      if (w.description) {
        html += '  <div class="resume__entry-desc">' + formatDescription(w.description) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderModernProjectsSection(d) {
    if (d.projects.length === 0) return '';
    // Check if all projects are empty
    const hasAnyContent = d.projects.some(p => p.name || p.role || p.description);
    if (!hasAnyContent) return '';
    
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">项目经历</div>';
    d.projects.forEach(p => {
      const hasContent = p.name || p.role || p.description;
      if (!hasContent) return;

      html += '<div class="resume__entry">';
      html += '  <div class="resume__entry-header">';
      html += '    <span class="resume__entry-title">' + ph(p.name, '项目名称') + '</span>';
      if (p.link) {
        html += '    <a class="resume__project-link" href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.link) + '</a>';
      }
      html += '  </div>';
      if (p.role) {
        html += '  <div class="resume__entry-subtitle">' + esc(p.role) + '</div>';
      }
      if (p.description) {
        html += '  <div class="resume__entry-desc">' + formatDescription(p.description) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // --- Creative template section helpers ---

  function renderCreativeWorkSection(d) {
    if (d.work.length === 0) return '';
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">工作经历</div>';
    d.work.forEach(w => {
      const hasContent = w.company || w.position || w.description;
      if (!hasContent && d.work.length === 1) {
        html += '<div class="resume__entry">';
        html += '  <div class="resume__creative-entry-line">';
        html += '    <span class="resume__entry-title placeholder">某某科技有限公司</span>';
        html += '    <span class="resume__entry-subtitle placeholder">高级前端工程师</span>';
        html += '  </div>';
        html += '  <div class="resume__creative-date placeholder">2020.06 — 至今</div>';
        html += '  <div class="resume__entry-desc placeholder">负责公司核心产品的前端架构设计与开发工作</div>';
        html += '</div>';
        return;
      }
      if (!hasContent) return;

      html += '<div class="resume__entry">';
      html += '  <div class="resume__creative-entry-line">';
      html += '    <span class="resume__entry-title">' + ph(w.company, '公司名称') + '</span>';
      if (w.position) {
        html += '    <span class="resume__entry-subtitle">' + esc(w.position) + '</span>';
      }
      html += '  </div>';
      const dateRange = (w.startDate || w.endDate)
        ? formatDate(w.startDate) + ' — ' + (formatDate(w.endDate) || '至今')
        : '';
      if (dateRange) {
        html += '  <div class="resume__creative-date">' + esc(dateRange) + '</div>';
      }
      if (w.description) {
        html += '  <div class="resume__entry-desc">' + formatDescription(w.description) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderCreativeEducationSection(d) {
    if (d.education.length === 0) return '';
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">教育背景</div>';
    d.education.forEach(e => {
      const hasContent = e.school || e.major || e.degree;
      if (!hasContent && d.education.length === 1) {
        html += '<div class="resume__entry">';
        html += '  <div class="resume__entry-header">';
        html += '    <span class="resume__entry-title placeholder">北京大学</span>';
        html += '    <span class="resume__entry-date placeholder">2016.09 — 2020.06</span>';
        html += '  </div>';
        html += '  <div class="resume__entry-subtitle placeholder">计算机科学与技术 · 本科</div>';
        html += '</div>';
        return;
      }
      if (!hasContent) return;

      html += '<div class="resume__entry">';
      html += '  <div class="resume__entry-header">';
      html += '    <span class="resume__entry-title">' + ph(e.school, '学校名称') + '</span>';
      const dateRange = (e.startDate || e.endDate)
        ? formatDate(e.startDate) + ' — ' + formatDate(e.endDate)
        : '';
      if (dateRange) {
        html += '    <span class="resume__entry-date">' + esc(dateRange) + '</span>';
      }
      html += '  </div>';
      const eduDetail = [e.major, e.degree].filter(Boolean).join(' · ');
      if (eduDetail) {
        html += '  <div class="resume__entry-subtitle">' + esc(eduDetail) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderCreativeSkillsSection(d) {
    if (d.skills.length === 0) return '';
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">技能特长</div>';
    html += '  <div class="resume__skills-list">';
    d.skills.forEach(skill => {
      html += '<span class="resume__skill-tag">' + esc(skill) + '</span>';
    });
    html += '  </div>';
    html += '</div>';
    return html;
  }

  function renderCreativeProjectsSection(d) {
    if (d.projects.length === 0) return '';
    // Check if all projects are empty
    const hasAnyContent = d.projects.some(p => p.name || p.role || p.description);
    if (!hasAnyContent) return '';
    
    let html = '<div class="resume__section">';
    html += '  <div class="resume__section-title">项目经历</div>';
    d.projects.forEach(p => {
      const hasContent = p.name || p.role || p.description;
      if (!hasContent) return;

      html += '<div class="resume__entry">';
      html += '  <div class="resume__entry-header">';
      html += '    <span class="resume__entry-title">' + ph(p.name, '项目名称') + '</span>';
      if (p.link) {
        html += '    <a class="resume__project-link" href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.link) + '</a>';
      }
      html += '  </div>';
      if (p.role) {
        html += '  <div class="resume__entry-subtitle">' + esc(p.role) + '</div>';
      }
      if (p.description) {
        html += '  <div class="resume__entry-desc">' + formatDescription(p.description) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // ============================================================
  // 5. EDITOR RENDERING — Dynamic Sections
  // ============================================================

  /** Render a single work entry form */
  function renderWorkEntry(entry, index) {
    return `
      <div class="entry" data-entry-type="work" data-entry-index="${index}" data-draggable>
        <span class="entry__grip" title="拖拽排序"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/></svg></span>
        <button class="btn btn--danger-ghost entry__remove" data-remove="work.${index}" title="删除此条工作经历" aria-label="删除此条工作经历">×</button>
        <div class="field">
          <label class="field__label" for="work-company-${index}">公司</label>
          <input class="field__input" type="text" id="work-company-${index}" data-field="work.${index}.company" value="${esc(entry.company)}" placeholder="某某科技有限公司">
        </div>
        <div class="field">
          <label class="field__label" for="work-position-${index}">职位</label>
          <input class="field__input" type="text" id="work-position-${index}" data-field="work.${index}.position" value="${esc(entry.position)}" placeholder="高级前端工程师">
        </div>
        <div class="field--row">
          <div class="field">
            <label class="field__label" for="work-start-${index}">开始时间</label>
            <input class="field__input" type="month" id="work-start-${index}" data-field="work.${index}.startDate" value="${esc(entry.startDate)}">
          </div>
          <div class="field">
            <label class="field__label" for="work-end-${index}">结束时间</label>
            <input class="field__input" type="month" id="work-end-${index}" data-field="work.${index}.endDate" value="${esc(entry.endDate)}" placeholder="留空表示至今">
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="work-desc-${index}">工作描述</label>
          <textarea class="field__textarea" id="work-desc-${index}" data-field="work.${index}.description" placeholder="负责公司核心产品的前端架构设计&#10;- 主导技术选型与方案评审&#10;- 优化页面加载性能，提升 40%">${esc(entry.description)}</textarea>
        </div>
      </div>
    `;
  }

  /** Render a single education entry form */
  function renderEducationEntry(entry, index) {
    return `
      <div class="entry" data-entry-type="education" data-entry-index="${index}" data-draggable>
        <span class="entry__grip" title="拖拽排序"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/></svg></span>
        <button class="btn btn--danger-ghost entry__remove" data-remove="education.${index}" title="删除此条教育经历" aria-label="删除此条教育经历">×</button>
        <div class="field">
          <label class="field__label" for="edu-school-${index}">学校</label>
          <input class="field__input" type="text" id="edu-school-${index}" data-field="education.${index}.school" value="${esc(entry.school)}" placeholder="北京大学">
        </div>
        <div class="field--row">
          <div class="field">
            <label class="field__label" for="edu-major-${index}">专业</label>
            <input class="field__input" type="text" id="edu-major-${index}" data-field="education.${index}.major" value="${esc(entry.major)}" placeholder="计算机科学与技术">
          </div>
          <div class="field">
            <label class="field__label" for="edu-degree-${index}">学位</label>
            <input class="field__input" type="text" id="edu-degree-${index}" data-field="education.${index}.degree" value="${esc(entry.degree)}" placeholder="本科">
          </div>
        </div>
        <div class="field--row">
          <div class="field">
            <label class="field__label" for="edu-start-${index}">开始时间</label>
            <input class="field__input" type="month" id="edu-start-${index}" data-field="education.${index}.startDate" value="${esc(entry.startDate)}">
          </div>
          <div class="field">
            <label class="field__label" for="edu-end-${index}">结束时间</label>
            <input class="field__input" type="month" id="edu-end-${index}" data-field="education.${index}.endDate" value="${esc(entry.endDate)}">
          </div>
        </div>
      </div>
    `;
  }

  /** Render a single project entry form */
  function renderProjectEntry(entry, index) {
    return `
      <div class="entry" data-entry-type="projects" data-entry-index="${index}" data-draggable>
        <span class="entry__grip" title="拖拽排序"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/></svg></span>
        <button class="btn btn--danger-ghost entry__remove" data-remove="projects.${index}" title="删除此条项目经历" aria-label="删除此条项目经历">×</button>
        <div class="field--row">
          <div class="field">
            <label class="field__label" for="proj-name-${index}">项目名</label>
            <input class="field__input" type="text" id="proj-name-${index}" data-field="projects.${index}.name" value="${esc(entry.name)}" placeholder="智能数据可视化平台">
          </div>
          <div class="field">
            <label class="field__label" for="proj-role-${index}">角色</label>
            <input class="field__input" type="text" id="proj-role-${index}" data-field="projects.${index}.role" value="${esc(entry.role)}" placeholder="前端负责人">
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="proj-desc-${index}">描述</label>
          <textarea class="field__textarea" id="proj-desc-${index}" data-field="projects.${index}.description" placeholder="主导前端架构设计，实现高性能数据可视化方案&#10;- 采用 WebGL 渲染百万级数据点&#10;- 封装可复用图表组件库">${esc(entry.description)}</textarea>
        </div>
        <div class="field">
          <label class="field__label" for="proj-link-${index}">链接</label>
          <input class="field__input" type="url" id="proj-link-${index}" data-field="projects.${index}.link" value="${esc(entry.link)}" placeholder="https://github.com/...">
        </div>
      </div>
    `;
  }

  /** Render all dynamic sections */
  function renderDynamicSections() {
    // Work entries
    const workContainer = $('#work-entries');
    let workHtml = '';
    resumeData.work.forEach((entry, i) => {
      workHtml += renderWorkEntry(entry, i);
    });
    workHtml += '<button class="btn btn--add" data-add="work">+ 添加工作经历</button>';
    workContainer.innerHTML = workHtml;

    // Education entries
    const eduContainer = $('#education-entries');
    let eduHtml = '';
    resumeData.education.forEach((entry, i) => {
      eduHtml += renderEducationEntry(entry, i);
    });
    eduHtml += '<button class="btn btn--add" data-add="education">+ 添加教育背景</button>';
    eduContainer.innerHTML = eduHtml;

    // Project entries
    const projContainer = $('#projects-entries');
    let projHtml = '';
    resumeData.projects.forEach((entry, i) => {
      projHtml += renderProjectEntry(entry, i);
    });
    projHtml += '<button class="btn btn--add" data-add="projects">+ 添加项目经历</button>';
    projContainer.innerHTML = projHtml;

    // Skills tags
    renderSkillsTags();
  }

  /** Render skills tags */
  function renderSkillsTags() {
    const tagsContainer = $('#skills-tags');
    let html = '';
    resumeData.skills.forEach((skill, i) => {
      html += `<span class="skill-tag">${esc(skill)}<button class="skill-tag__remove" data-remove-skill="${i}" aria-label="删除技能 ${esc(skill)}">×</button></span>`;
    });
    tagsContainer.innerHTML = html;
  }

  // ============================================================
  // 6. DATA UPDATE HELPERS
  // ============================================================

  /** Set a value in resumeData by dot-notation path */
  function setByPath(path, value) {
    const parts = path.split('.');
    let obj = resumeData;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = isNaN(parts[i]) ? parts[i] : parseInt(parts[i], 10);
      obj = obj[key];
    }
    const lastKey = isNaN(parts[parts.length - 1]) ? parts[parts.length - 1] : parseInt(parts[parts.length - 1], 10);
    obj[lastKey] = value;
    ResumeManager.markDirty();
  }

  /** Add a new entry to a dynamic section */
  function addEntry(type) {
    switch (type) {
      case 'work':
        resumeData.work.push({ company: '', position: '', startDate: '', endDate: '', description: '' });
        break;
      case 'education':
        resumeData.education.push({ school: '', major: '', degree: '', startDate: '', endDate: '' });
        break;
      case 'projects':
        resumeData.projects.push({ name: '', role: '', description: '', link: '' });
        break;
    }
    ResumeManager.markDirty();
    renderDynamicSections();
    attachSparkleButtons();
    renderPreview();
  }

  /** Remove an entry from a dynamic section */
  function removeEntry(type, index) {
    switch (type) {
      case 'work':
        if (resumeData.work.length > 1) {
          resumeData.work.splice(index, 1);
        }
        break;
      case 'education':
        if (resumeData.education.length > 1) {
          resumeData.education.splice(index, 1);
        }
        break;
      case 'projects':
        if (resumeData.projects.length > 1) {
          resumeData.projects.splice(index, 1);
        }
        break;
    }
    ResumeManager.markDirty();
    hideSuggestions();
    renderDynamicSections();
    attachSparkleButtons();
    renderPreview();
  }

  // ============================================================
  // 6b. PHOTO UPLOAD
  // ============================================================

  /** Update the photo preview in the editor */
  function updatePhotoPreview() {
    var photoPreview = $('#photo-preview');
    var btnRemove = $('#btn-remove-photo');
    var styleControls = $('#photo-style-controls');
    var posSelect = $('#photo-position');
    var sizeSelect = $('#photo-size');
    if (!photoPreview) return;
    if (resumeData.photo) {
      photoPreview.innerHTML = '<img src="' + resumeData.photo + '" class="photo-upload__img" alt="照片">';
      if (btnRemove) btnRemove.style.display = '';
      if (styleControls) styleControls.style.display = '';
    } else {
      photoPreview.innerHTML = '<svg class="photo-upload__placeholder" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
      if (btnRemove) btnRemove.style.display = 'none';
      if (styleControls) styleControls.style.display = 'none';
    }
    // Sync select values
    if (posSelect) posSelect.value = resumeData.photoPosition || 'left';
    if (sizeSelect) sizeSelect.value = resumeData.photoSize || 'medium';
  }

  /** Initialize photo upload events */
  function initPhotoUpload() {
    var photoInput = $('#photo-input');
    var btnUploadPhoto = $('#btn-upload-photo');
    var btnRemovePhoto = $('#btn-remove-photo');

    if (btnUploadPhoto && photoInput) {
      btnUploadPhoto.addEventListener('click', function () {
        photoInput.click();
      });
    }

    if (photoInput) {
      photoInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
          alert('照片大小不能超过 2MB');
          return;
        }

        var reader = new FileReader();
        reader.onload = function (ev) {
          // Resize to reasonable size (max 300x300) to avoid bloating localStorage
          var img = new Image();
          img.onload = function () {
            var canvas = document.createElement('canvas');
            var MAX = 300;
            var w = img.width;
            var h = img.height;
            if (w > h) { h = h * MAX / w; w = MAX; }
            else { w = w * MAX / h; h = MAX; }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resumeData.photo = canvas.toDataURL('image/jpeg', 0.8);
            ResumeManager.markDirty();
            updatePhotoPreview();
            renderPreview();
            scalePreview();
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnRemovePhoto) {
      btnRemovePhoto.addEventListener('click', function () {
        resumeData.photo = '';
        resumeData.photoPosition = 'left';
        resumeData.photoSize = 'large';
        if (photoInput) photoInput.value = '';
        ResumeManager.markDirty();
        updatePhotoPreview();
        renderPreview();
        scalePreview();
      });
    }

    // Photo position and size controls
    var posSelect = $('#photo-position');
    var sizeSelect = $('#photo-size');

    if (posSelect) {
      posSelect.addEventListener('change', function () {
        resumeData.photoPosition = posSelect.value;
        ResumeManager.markDirty();
        renderPreview();
        scalePreview();
      });
    }

    if (sizeSelect) {
      sizeSelect.addEventListener('change', function () {
        resumeData.photoSize = sizeSelect.value;
        ResumeManager.markDirty();
        renderPreview();
        scalePreview();
      });
    }
  }

  // ============================================================
  // 7. EVENT HANDLING
  // ============================================================

  /** Initialize all event listeners */
  function initEvents() {
    // --- Section collapse/expand ---
    $$('.section__header').forEach(header => {
      header.addEventListener('click', (e) => {
        // Don't toggle if clicking the drag handle
        if (e.target.closest('.section__grip')) return;
        const section = header.closest('.section');
        const isCollapsed = section.classList.contains('section--collapsed');
        section.classList.toggle('section--collapsed');
        header.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
        // Close any open suggestion panel when collapsing a section
        if (!isCollapsed) {
          hideSuggestions();
        }
      });
    });

    // --- Simple field inputs (personal info) ---
    $$('.field__input[data-field], .field__textarea[data-field]').forEach(input => {
      // Skip dynamic fields — they get re-bound after renderDynamicSections
      if (input.dataset.field.includes('.')) return;

      input.addEventListener('input', () => {
        setByPath(input.dataset.field, input.value);
        debouncedRender();
      });
    });

    // --- Delegated events on editor ---
    editor.addEventListener('input', handleDelegatedInput);
    editor.addEventListener('click', handleDelegatedClick);
    editor.addEventListener('keydown', handleDelegatedKeydown);

    // --- Skills input ---
    const skillsInput = $('#skills-input');
    skillsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const value = skillsInput.value.replace(/,/g, '').trim();
        if (value && !resumeData.skills.includes(value)) {
          resumeData.skills.push(value);
          skillsInput.value = '';
          ResumeManager.markDirty();
          renderSkillsTags();
          renderPreview();
        }
      }
    });

    // --- Export PDF ---
    $('#btn-export').addEventListener('click', exportPDF);

    // --- Save / Load ---
    $('#btn-save').addEventListener('click', function() {
      var dialog = $('#save-dialog');
      ResumeManager.listSlots();
      dialog.showModal();
    });
    $('#save-dialog-close').addEventListener('click', function() {
      $('#save-dialog').close();
    });
    $('#save-dialog-save').addEventListener('click', function() {
      ResumeManager.saveToSlot();
    });
    $('#save-dialog-saveas').addEventListener('click', function() {
      ResumeManager.saveToNewSlot();
    });
    $('#save-slot-list').addEventListener('click', function(e) {
      var loadBtn = e.target.closest('.save-slot-item__load');
      var delBtn = e.target.closest('.save-slot-item__delete');
      if (loadBtn) {
        var slotName = loadBtn.getAttribute('data-slot');
        ResumeManager.loadFromSlot(slotName);
      } else if (delBtn) {
        var slotName = delBtn.getAttribute('data-slot');
        ResumeManager.deleteSlot(slotName);
      }
    });

    // --- Template switcher ---
    const templateMenu = $('#template-menu');
    const btnTemplate = $('#btn-template');
    const btnTemplateLabel = $('#btn-template-label');

    // Position popover below the button
    function positionTemplatePopover() {
      if (!btnTemplate || !templateMenu || !templateMenu.matches(':popover-open')) return;
      const btnRect = btnTemplate.getBoundingClientRect();
      templateMenu.style.top = (btnRect.bottom + 4) + 'px';
      templateMenu.style.left = btnRect.left + 'px';
      // Check if menu overflows viewport right
      const menuRect = templateMenu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth - 8) {
        templateMenu.style.left = (window.innerWidth - menuRect.width - 8) + 'px';
      }
    }

    // Reposition on toggle and resize
    templateMenu.addEventListener('toggle', (e) => {
      if (e.newState === 'open') {
        requestAnimationFrame(positionTemplatePopover);
      }
    });
    window.addEventListener('resize', debounce(positionTemplatePopover, 100));

    // Update active state in menu
    function updateTemplateMenuState() {
      $$('.template-menu__item', templateMenu).forEach(item => {
        item.classList.toggle('template-menu__item--active', item.dataset.template === currentTemplate);
      });
      btnTemplateLabel.textContent = templateNames[currentTemplate] + '模板';
    }

    // Handle template selection
    templateMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.template-menu__item');
      if (!item) return;
      const template = item.dataset.template;
      if (template && template !== currentTemplate) {
        currentTemplate = template;
        updateTemplateMenuState();
        renderPreview();
        scalePreview();
      }
      // Close the popover
      templateMenu.hidePopover();
    });

    // Set initial state
    updateTemplateMenuState();

    // --- Scale preview on resize ---
    window.addEventListener('resize', debounce(scalePreview, 100));
  }

  /** Handle input events via delegation (for dynamic fields) */
  function handleDelegatedInput(e) {
    const target = e.target;
    const field = target.dataset && target.dataset.field;
    if (!field) return;

    setByPath(field, target.value);
    debouncedRender();
  }

  /** Handle click events via delegation */
  function handleDelegatedClick(e) {
    // Don't process clicks on drag grips
    if (e.target.closest('.entry__grip') || e.target.closest('.section__grip')) return;

    // AI sparkle button
    const sparkleBtn = e.target.closest('.ai-sparkle');
    if (sparkleBtn) {
      e.stopPropagation();
      handleSparkleClick(sparkleBtn);
      return;
    }

    const target = e.target.closest('[data-add], [data-remove], [data-remove-skill]');
    if (!target) return;

    // Add entry
    if (target.dataset.add) {
      addEntry(target.dataset.add);
      return;
    }

    // Remove entry
    if (target.dataset.remove) {
      const [type, indexStr] = target.dataset.remove.split('.');
      const index = parseInt(indexStr, 10);
      removeEntry(type, index);
      return;
    }

    // Remove skill
    if (target.dataset.removeSkill !== undefined) {
      const skillIndex = parseInt(target.dataset.removeSkill, 10);
      resumeData.skills.splice(skillIndex, 1);
      ResumeManager.markDirty();
      renderSkillsTags();
      renderPreview();
      return;
    }
  }

  /** Handle keydown events via delegation */
  function handleDelegatedKeydown(e) {
    // No special keydown handling needed currently
  }

  // ============================================================
  // 8. DRAG AND DROP
  // ============================================================

  // --- State ---
  let dragState = {
    type: null,       // 'section' | 'entry'
    sectionKey: null,  // for section drag: the section key being dragged
    entryType: null,   // for entry drag: 'work' | 'education' | 'projects'
    entryIndex: null,  // for entry drag: the index being dragged
    dropTarget: null,  // current drop target element
    dropPosition: null // 'before' | 'after'
  };

  // Touch drag state
  let touchState = {
    active: false,
    type: null,       // 'section' | 'entry'
    element: null,    // the element being dragged
    ghost: null,      // the ghost element following the finger
    startX: 0,
    startY: 0,
    timer: null,
    sectionKey: null,
    entryType: null,
    entryIndex: null,
    dropTarget: null,
    dropPosition: null,
    offsetX: 0,
    offsetY: 0
  };

  /** Initialize drag and drop functionality */
  function initDragAndDrop() {
    // Add data-draggable attribute and grip icons to section headers
    sectionOrder.forEach(key => {
      const section = $('[data-section="' + key + '"]');
      if (section) {
        section.setAttribute('data-draggable', '');
        const header = $('.section__header', section);
        if (header && !$('.section__grip', header)) {
          const grip = document.createElement('span');
          grip.className = 'section__grip';
          grip.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/></svg>';
          grip.setAttribute('title', '拖拽排序');
          header.insertBefore(grip, header.firstChild);
        }
      }
    });

    // --- Section drag handlers (mouse) ---
    $$('.section[data-draggable]').forEach(section => {
      const grip = $('.section__grip', section);
      if (grip) {
        grip.setAttribute('draggable', 'true');
        grip.addEventListener('dragstart', handleSectionDragStart);
      }
      section.addEventListener('dragover', handleSectionDragOver);
      section.addEventListener('dragleave', handleSectionDragLeave);
      section.addEventListener('drop', handleSectionDrop);
      section.addEventListener('dragend', handleSectionDragEnd);
    });

    // --- Entry drag handlers (mouse) ---
    editor.addEventListener('dragover', handleEntryDragOver);
    editor.addEventListener('drop', handleEntryDrop);
    editor.addEventListener('dragend', handleEntryDragEnd);

    // --- Touch handlers ---
    editor.addEventListener('touchstart', handleTouchStart, { passive: false });
    editor.addEventListener('touchmove', handleTouchMove, { passive: false });
    editor.addEventListener('touchend', handleTouchEnd);
    editor.addEventListener('touchcancel', handleTouchEnd);
  }

  /** Reorder editor sections in the DOM to match sectionOrder */
  function reorderEditorSections() {
    const personalSection = $('[data-section="personal"]');

    // Reorder: personal always first, then sections in sectionOrder
    sectionOrder.forEach(key => {
      const section = $('[data-section="' + key + '"]');
      if (section) {
        editor.appendChild(section);
      }
    });

    // Ensure personal is always first
    if (personalSection && personalSection !== editor.children[0]) {
      editor.insertBefore(personalSection, editor.children[0]);
    }
  }

  // ---- Section Drag (Mouse) ----

  function handleSectionDragStart(e) {
    const section = e.target.closest('.section[data-draggable]');
    if (!section) return;

    const sectionKey = section.dataset.section;
    dragState.type = 'section';
    dragState.sectionKey = sectionKey;
    dragState.dropTarget = null;
    dragState.dropPosition = null;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'section:' + sectionKey);

    // Slight delay to let the browser capture the drag image before adding styles
    requestAnimationFrame(() => {
      section.classList.add('section--dragging');
    });
  }

  function handleSectionDragOver(e) {
    if (dragState.type !== 'section') return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const targetSection = e.target.closest('.section[data-draggable]');
    if (!targetSection || targetSection.dataset.section === dragState.sectionKey) {
      clearSectionDragOver();
      return;
    }

    clearSectionDragOver();

    // Determine if mouse is in top or bottom half
    const rect = targetSection.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';

    targetSection.classList.add(position === 'before' ? 'section--drag-over-top' : 'section--drag-over-bottom');

    dragState.dropTarget = targetSection;
    dragState.dropPosition = position;
  }

  function handleSectionDragLeave(e) {
    const targetSection = e.target.closest('.section[data-draggable]');
    if (targetSection) {
      targetSection.classList.remove('section--drag-over-top', 'section--drag-over-bottom');
    }
  }

  function handleSectionDrop(e) {
    if (dragState.type !== 'section') return;

    e.preventDefault();
    clearSectionDragOver();

    const targetSection = e.target.closest('.section[data-draggable]');
    if (!targetSection || !dragState.sectionKey) return;

    const targetKey = targetSection.dataset.section;
    if (targetKey === dragState.sectionKey) return;

    // Reorder sectionOrder
    const fromIndex = sectionOrder.indexOf(dragState.sectionKey);
    const toIndex = sectionOrder.indexOf(targetKey);

    if (fromIndex === -1 || toIndex === -1) return;

    // Remove from old position
    sectionOrder.splice(fromIndex, 1);

    // Calculate new insert position
    const insertIndex = dragState.dropPosition === 'before' ? toIndex : toIndex + 1;
    // Adjust if removing from before the target
    const adjustedIndex = fromIndex < toIndex ? insertIndex - 1 : insertIndex;

    sectionOrder.splice(adjustedIndex < 0 ? 0 : adjustedIndex, 0, dragState.sectionKey);

    // Reorder DOM and re-render preview
    reorderEditorSections();
    renderPreview();

    resetDragState();
  }

  function handleSectionDragEnd(e) {
    const section = e.target.closest('.section[data-draggable]');
    if (section) {
      section.classList.remove('section--dragging');
    }
    clearSectionDragOver();
    resetDragState();
  }

  function clearSectionDragOver() {
    $$('.section--drag-over-top, .section--drag-over-bottom').forEach(el => {
      el.classList.remove('section--drag-over-top', 'section--drag-over-bottom');
    });
  }

  // ---- Entry Drag (Mouse) ----

  function handleEntryDragOver(e) {
    if (dragState.type !== 'entry') return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const targetEntry = e.target.closest('.entry[data-entry-type="' + dragState.entryType + '"]');
    if (!targetEntry || targetEntry === getDraggedEntryElement()) {
      removeDropIndicators();
      return;
    }

    // Determine position
    const rect = targetEntry.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';

    // Remove existing indicators
    removeDropIndicators();

    // Add drop indicator
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    indicator.dataset.dropIndicator = '';

    if (position === 'before') {
      targetEntry.parentNode.insertBefore(indicator, targetEntry);
    } else {
      targetEntry.parentNode.insertBefore(indicator, targetEntry.nextSibling);
    }

    dragState.dropTarget = targetEntry;
    dragState.dropPosition = position;
  }

  function handleEntryDrop(e) {
    if (dragState.type !== 'entry') return;

    e.preventDefault();
    removeDropIndicators();

    if (!dragState.dropTarget || dragState.entryIndex === null) return;

    const targetEntry = dragState.dropTarget.closest('.entry[data-entry-type="' + dragState.entryType + '"]');
    if (!targetEntry) return;

    const targetIndex = parseInt(targetEntry.dataset.entryIndex, 10);
    if (targetIndex === dragState.entryIndex) return;

    // Reorder the data array
    const arr = resumeData[dragState.entryType];
    const item = arr.splice(dragState.entryIndex, 1)[0];

    // Calculate insert index
    let insertIndex = targetIndex;
    if (dragState.entryIndex < targetIndex) {
      insertIndex = dragState.dropPosition === 'before' ? targetIndex - 1 : targetIndex;
    } else {
      insertIndex = dragState.dropPosition === 'before' ? targetIndex : targetIndex + 1;
    }

    arr.splice(insertIndex < 0 ? 0 : insertIndex, 0, item);

    ResumeManager.markDirty();

    // Re-render
    renderDynamicSections();
    attachSparkleButtons();
    renderPreview();

    resetDragState();
  }

  function handleEntryDragEnd(e) {
    const entry = e.target.closest('.entry[data-draggable]');
    if (entry) {
      entry.classList.remove('entry--dragging');
    }
    removeDropIndicators();
    resetDragState();
  }

  function getDraggedEntryElement() {
    if (dragState.type !== 'entry') return null;
    return $('[data-entry-type="' + dragState.entryType + '"][data-entry-index="' + dragState.entryIndex + '"]');
  }

  function removeDropIndicators() {
    $$('[data-drop-indicator]').forEach(el => el.remove());
  }

  function resetDragState() {
    dragState = {
      type: null,
      sectionKey: null,
      entryType: null,
      entryIndex: null,
      dropTarget: null,
      dropPosition: null
    };
  }

  // ---- Touch Drag ----

  function handleTouchStart(e) {
    const grip = e.target.closest('.entry__grip, .section__grip');
    if (!grip) return;

    const touch = e.touches[0];
    touchState.startX = touch.clientX;
    touchState.startY = touch.clientY;

    // Determine drag type
    if (grip.classList.contains('section__grip')) {
      const section = grip.closest('.section[data-draggable]');
      if (!section) return;
      touchState.type = 'section';
      touchState.sectionKey = section.dataset.section;
      touchState.element = section;
    } else if (grip.classList.contains('entry__grip')) {
      const entry = grip.closest('.entry[data-draggable]');
      if (!entry) return;
      touchState.type = 'entry';
      touchState.entryType = entry.dataset.entryType;
      touchState.entryIndex = parseInt(entry.dataset.entryIndex, 10);
      touchState.element = entry;
    }

    // Delay before starting drag to distinguish from scroll
    touchState.timer = setTimeout(() => {
      touchState.active = true;
      startTouchDrag(e, touch);
    }, 150);
  }

  function startTouchDrag(e, touch) {
    if (!touchState.element) return;

    // Prevent scrolling during drag
    e.preventDefault();

    // Create ghost element
    const rect = touchState.element.getBoundingClientRect();
    const ghost = touchState.element.cloneNode(true);
    ghost.className = 'drag-ghost';
    ghost.style.width = rect.width + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    document.body.appendChild(ghost);
    touchState.ghost = ghost;

    // Mark original as dragging
    touchState.element.classList.add(
      touchState.type === 'section' ? 'section--dragging' : 'entry--dragging'
    );

    // Offset from touch point to element top-left
    touchState.offsetX = touch.clientX - rect.left;
    touchState.offsetY = touch.clientY - rect.top;
  }

  function handleTouchMove(e) {
    if (!touchState.active) {
      // Check if moved enough to cancel the hold timer
      if (touchState.timer) {
        const touch = e.touches[0];
        const dx = touch.clientX - touchState.startX;
        const dy = touch.clientY - touchState.startY;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(touchState.timer);
          touchState.timer = null;
        }
      }
      return;
    }

    e.preventDefault();

    const touch = e.touches[0];

    // Move ghost
    if (touchState.ghost) {
      touchState.ghost.style.left = (touch.clientX - touchState.offsetX) + 'px';
      touchState.ghost.style.top = (touch.clientY - touchState.offsetY) + 'px';
    }

    // Find drop target
    if (touchState.type === 'section') {
      handleTouchSectionMove(touch);
    } else if (touchState.type === 'entry') {
      handleTouchEntryMove(touch);
    }
  }

  function handleTouchSectionMove(touch) {
    clearSectionDragOver();

    // Find section under touch point (hide ghost temporarily)
    if (touchState.ghost) touchState.ghost.style.display = 'none';
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    if (touchState.ghost) touchState.ghost.style.display = '';

    if (!elementBelow) return;

    const targetSection = elementBelow.closest('.section[data-draggable]');
    if (!targetSection || targetSection.dataset.section === touchState.sectionKey) return;

    const rect = targetSection.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = touch.clientY < midY ? 'before' : 'after';

    targetSection.classList.add(position === 'before' ? 'section--drag-over-top' : 'section--drag-over-bottom');
    touchState.dropTarget = targetSection;
    touchState.dropPosition = position;
  }

  function handleTouchEntryMove(touch) {
    removeDropIndicators();

    if (touchState.ghost) touchState.ghost.style.display = 'none';
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    if (touchState.ghost) touchState.ghost.style.display = '';

    if (!elementBelow) return;

    const targetEntry = elementBelow.closest('.entry[data-entry-type="' + touchState.entryType + '"]');
    if (!targetEntry || targetEntry === touchState.element) return;

    const rect = targetEntry.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = touch.clientY < midY ? 'before' : 'after';

    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    indicator.dataset.dropIndicator = '';

    if (position === 'before') {
      targetEntry.parentNode.insertBefore(indicator, targetEntry);
    } else {
      targetEntry.parentNode.insertBefore(indicator, targetEntry.nextSibling);
    }

    touchState.dropTarget = targetEntry;
    touchState.dropPosition = position;
  }

  function handleTouchEnd(e) {
    clearTimeout(touchState.timer);
    touchState.timer = null;

    if (!touchState.active) {
      touchState.type = null;
      touchState.element = null;
      return;
    }

    // Execute drop
    if (touchState.type === 'section' && touchState.dropTarget) {
      const targetKey = touchState.dropTarget.dataset.section;
      if (targetKey !== touchState.sectionKey) {
        const fromIndex = sectionOrder.indexOf(touchState.sectionKey);
        const toIndex = sectionOrder.indexOf(targetKey);

        if (fromIndex !== -1 && toIndex !== -1) {
          sectionOrder.splice(fromIndex, 1);
          const insertIndex = touchState.dropPosition === 'before' ? toIndex : toIndex + 1;
          const adjustedIndex = fromIndex < toIndex ? insertIndex - 1 : insertIndex;
          sectionOrder.splice(adjustedIndex < 0 ? 0 : adjustedIndex, 0, touchState.sectionKey);
          ResumeManager.markDirty();
          reorderEditorSections();
          renderPreview();
        }
      }
    } else if (touchState.type === 'entry' && touchState.dropTarget && touchState.entryIndex !== null) {
      const targetIndex = parseInt(touchState.dropTarget.dataset.entryIndex, 10);
      if (targetIndex !== touchState.entryIndex) {
        const arr = resumeData[touchState.entryType];
        const item = arr.splice(touchState.entryIndex, 1)[0];

        let insertIndex = targetIndex;
        if (touchState.entryIndex < targetIndex) {
          insertIndex = touchState.dropPosition === 'before' ? targetIndex - 1 : targetIndex;
        } else {
          insertIndex = touchState.dropPosition === 'before' ? targetIndex : targetIndex + 1;
        }

        arr.splice(insertIndex < 0 ? 0 : insertIndex, 0, item);
        ResumeManager.markDirty();
        renderDynamicSections();
        attachSparkleButtons();
        renderPreview();
      }
    }

    // Cleanup
    if (touchState.element) {
      touchState.element.classList.remove('section--dragging', 'entry--dragging');
    }
    if (touchState.ghost) {
      touchState.ghost.remove();
    }
    clearSectionDragOver();
    removeDropIndicators();

    touchState = {
      active: false,
      type: null,
      element: null,
      ghost: null,
      startX: 0,
      startY: 0,
      timer: null,
      sectionKey: null,
      entryType: null,
      entryIndex: null,
      dropTarget: null,
      dropPosition: null,
      offsetX: 0,
      offsetY: 0
    };
  }

  // ============================================================
  // 9. PDF EXPORT
  // ============================================================

  function exportPDF() {
    // Re-render pages specifically for export (not using scaled preview DOM)
    var d = resumeData;
    var blocks = splitContentBlocks(templates[currentTemplate](d));
    var pages = buildPages(d);
    var numPages = pages.length;

    if (numPages === 0) {
      alert('暂无内容可导出');
      return;
    }

    // Build export HTML — each page uses natural flow without fixed height
    var pagesHtml = '';
    var fontFamily = d.fontFamily || "'Source Sans 3','Noto Sans SC',sans-serif";
    var fontSize = d.fontSizeBase ? d.fontSizeBase + 'rem' : '1rem';
    var lineHeight = d.lineHeight || '1.5';

    for (var pi = 0; pi < numPages; pi++) {
      var pageBlocks = pages[pi];
      var pageContent = renderBlocks(pageBlocks);

      pagesHtml += '<div class="a4-page-export">\n';
      pagesHtml += '  <div class="a4-page-export__content">\n';
      pagesHtml += pageContent;
      pagesHtml += '  </div>\n';
      pagesHtml += '</div>\n';
    }

    // Use inline CSS (loaded via styles.js before app.js)
    var cssContent = typeof _INLINE_CSS !== 'undefined' ? _INLINE_CSS : '';

    // Get the Google Fonts link tag
    var fontLink = '';
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var li = 0; li < links.length; li++) {
      var h = links[li].getAttribute('href') || '';
      if (h.indexOf('fonts.googleapis.com') !== -1 ||
          h.indexOf('fonts.gstatic.com') !== -1) {
        fontLink += '<link rel="stylesheet" href="' + h + '">\n';
      }
    }

    var doc = '<!DOCTYPE html>\n' +
      '<html lang="zh-CN">\n' +
      '<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + (d.name || '简历') + ' - 导出</title>\n' +
      fontLink +
      '<style>\n' +
      cssContent +
      '\n' +
      '/* === Export overrides === */\n' +
      'body { margin: 0; padding: 0; background: #fff; }\n' +
      '.topbar, .editor, .ai-panel, .preview__zoom-bar, .preview__zoom-divider { display: none !important; }\n' +
      '.main { height: auto; }\n' +
      '.preview { background: none; padding: 0; overflow: visible; width: 100%; }\n' +
      '.preview__canvas { overflow: visible; padding: 0; }\n' +
      '.pages-container, .a4-page { display: none !important; }\n' +
      '\n' +
      '.a4-page-export {\n' +
      '  width: 210mm;\n' +
      '  min-height: 297mm;\n' +
      '  padding: 16mm 18mm;\n' +
      '  margin: 0 auto;\n' +
      '  box-sizing: border-box;\n' +
      '  position: relative;\n' +
      '  background: #fff;\n' +
      '  font-family: ' + fontFamily + '; font-size: ' + fontSize + '; line-height: ' + lineHeight + ';\n' +
      '  color: #1a1a1a;\n' +
      '  page-break-after: always;\n' +
      '  print-color-adjust: exact; -webkit-print-color-adjust: exact;\n' +
      '}\n' +
      '.a4-page-export:last-child { page-break-after: auto; }\n' +
      '.a4-page-export__content { position: relative; }\n' +
      '\n' +
      '@media print {\n' +
      '  @page { size: A4; margin: 0; }\n' +
      '  body { margin: 0; padding: 0; background: none; }\n' +
      '  * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }\n' +
      '  .a4-page-export { box-shadow: none; page-break-after: always; margin: 0; }\n' +
      '  .a4-page-export:last-child { page-break-after: auto; }\n' +
      '}\n' +
      '@page {\n' +
      '  size: A4;\n' +
      '  margin: 0;\n' +
      '}\n' +
      '</style>\n' +
      '</head>\n' +
      '<body>\n' +
      pagesHtml +
      '</body>\n' +
      '</html>';

    var blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (d.name || '简历') + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // 9b. AI SUGGESTION ENGINE (Local Rule-Based)
  // ============================================================

  const ResumeAdvisor = {
    suggest(fieldType, currentValue) {
      const value = (currentValue || '').trim();
      const suggestions = [];

      switch (fieldType) {
        case 'work-description':
        case 'project-description':
          this._checkDescription(value, suggestions);
          break;
        case 'selfEvaluation':
          this._checkSelfEvaluation(value, suggestions);
          break;
        case 'title':
        case 'position':
          this._checkTitle(value, suggestions);
          break;
        case 'skills':
          this._checkSkills(value, suggestions);
          break;
      }

      return suggestions;
    },

    _checkDescription(value, suggestions) {
      if (!value) {
        suggestions.push({
          type: 'tip',
          text: '添加具体的工作成果和数据，如：\'优化页面加载性能，提升40%\''
        });
        return;
      }

      // No numbers/metrics
      if (!/\d+%|\d+人|\d+个|\d+万|\d+次|\d+倍|\d+项|\d+年|\d+月|\d+天/.test(value)) {
        suggestions.push({
          type: 'append',
          text: '加入量化数据会让描述更有说服力，如：\'管理5人团队\'、\'提升30%效率\''
        });
      }

      // Passive voice
      if (/被|由[于于]?/.test(value)) {
        suggestions.push({
          type: 'tip',
          text: '使用主动语态更专业，如：\'主导了...\' 而非 \'被安排主导...\''
        });
      }

      // Very short lines
      const lines = value.split('\n').filter(l => l.trim());
      const hasShortLines = lines.some(l => l.replace(/^[-•·]\s*/, '').trim().length > 0 && l.replace(/^[-•·]\s*/, '').trim().length < 10);
      if (hasShortLines && lines.length > 1) {
        suggestions.push({
          type: 'tip',
          text: '每条描述建议包含具体行动+结果，如：\'设计并实现缓存策略，将API响应时间从800ms降至200ms\''
        });
      }

      // No bullet points (all one paragraph)
      if (lines.length === 1 && value.length > 30) {
        suggestions.push({
          type: 'replace',
          text: '使用分点描述更清晰，每行以 \'-\' 开头',
          replacement: value.replace(/[,，;；]\s*/g, '\n- ')
        });
      }

      // Starts with "负责"
      const firstLine = lines[0] || '';
      if (/^负责/.test(firstLine.trim())) {
        suggestions.push({
          type: 'tip',
          text: '避免仅用\'负责\'开头，使用更具体的动词如：\'设计并实现\'、\'主导\'、\'优化\'、\'搭建\''
        });
      }
    },

    _checkSelfEvaluation(value, suggestions) {
      if (!value) {
        suggestions.push({
          type: 'tip',
          text: '自我评价应突出核心优势和年资，如：\'8年全栈开发经验，擅长高并发系统架构\''
        });
        return;
      }

      if (value.length < 30) {
        suggestions.push({
          type: 'tip',
          text: '自我评价太短，建议补充2-3个核心优势'
        });
      }

      if (value.length > 150) {
        suggestions.push({
          type: 'tip',
          text: '自我评价较长，建议精简到120字以内，突出最核心的3个优势'
        });
      }
    },

    _checkTitle(value, suggestions) {
      if (!value) {
        suggestions.push({
          type: 'tip',
          text: '添加目标职位，如：\'高级前端工程师\' 或 \'全栈开发工程师\''
        });
        return;
      }

      if (/工程师/.test(value) && !/高级|资深|初级|中级|专家|首席|主任/.test(value)) {
        suggestions.push({
          type: 'tip',
          text: '考虑添加职级，如：\'高级前端工程师\' 或 \'资深架构师\''
        });
      }
    },

    _checkSkills(value, suggestions) {
      // value is the skills array joined or the raw count
      // We receive the raw skills array length context from the caller
      if (!value) {
        suggestions.push({
          type: 'tip',
          text: '添加3-8个核心技能，优先列出与目标职位最相关的'
        });
        return;
      }

      const count = value.split(/[,，、\s]+/).filter(Boolean).length;
      if (count < 3) {
        suggestions.push({
          type: 'tip',
          text: '建议至少列出5个技能，覆盖编程语言、框架、工具等'
        });
      }
    }
  };

  // ============================================================
  // 9c. AI SUGGESTION UI
  // ============================================================

  let activeSuggestionPanel = null;

  /** Determine the fieldType from a data-field path */
  function getFieldAiType(fieldEl) {
    const path = fieldEl.dataset.field;
    if (!path) return null;

    // Self evaluation
    if (path === 'selfEvaluation') return 'selfEvaluation';
    // Title
    if (path === 'title') return 'title';
    // Work position
    if (/work\.\d+\.position/.test(path)) return 'position';
    // Work description
    if (/work\.\d+\.description/.test(path)) return 'work-description';
    // Project description
    if (/projects\.\d+\.description/.test(path)) return 'project-description';
    // Skills
    if (path === 'skills' || fieldEl.id === 'skills-input') return 'skills';

    return null;
  }

  /** Create and attach sparkle buttons to eligible fields */
  function attachSparkleButtons() {
    // Textareas: selfEvaluation, work descriptions, project descriptions
    const textareas = $$('.field__textarea[data-field]', editor);
    textareas.forEach(ta => {
      const type = getFieldAiType(ta);
      if (!type) return;

      // Check if already wrapped
      const existingWrap = ta.closest('.field__input-wrap');
      if (existingWrap && existingWrap.querySelector('.ai-sparkle')) return;

      // Wrap textarea in .field__input-wrap
      const wrap = document.createElement('div');
      wrap.className = 'field__input-wrap field__input-wrap--has-sparkle';
      ta.parentNode.insertBefore(wrap, ta);
      wrap.appendChild(ta);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-sparkle ai-sparkle--textarea';
      btn.setAttribute('aria-label', 'AI 优化建议');
      btn.setAttribute('title', 'AI 优化建议');
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1l1.5 3.5L13 5.5l-2.5 2.5L11 11.5 8 9.5l-3 2-0.5-3.5L2 5.5l3.5-1L8 1z"/></svg>';
      btn.dataset.aiField = ta.dataset.field;
      wrap.appendChild(btn);
    });

    // Text inputs: title, work position
    const inputs = $$('.field__input[data-field]', editor);
    inputs.forEach(input => {
      const type = getFieldAiType(input);
      if (type !== 'title' && type !== 'position') return;

      // Check if already wrapped
      const existingWrap = input.closest('.field__input-wrap');
      if (existingWrap && existingWrap.querySelector('.ai-sparkle')) return;

      // Wrap input in .field__input-wrap
      const wrap = document.createElement('div');
      wrap.className = 'field__input-wrap field__input-wrap--has-sparkle';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-sparkle ai-sparkle--input';
      btn.setAttribute('aria-label', 'AI 优化建议');
      btn.setAttribute('title', 'AI 优化建议');
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1l1.5 3.5L13 5.5l-2.5 2.5L11 11.5 8 9.5l-3 2-0.5-3.5L2 5.5l3.5-1L8 1z"/></svg>';
      btn.dataset.aiField = input.dataset.field;
      wrap.appendChild(btn);
    });

    // Skills input
    const skillsInput = $('#skills-input');
    if (skillsInput) {
      const skillsContainer = skillsInput.closest('.skills-input');
      if (skillsContainer && !skillsContainer.querySelector('.ai-sparkle')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-sparkle ai-sparkle--input';
        btn.setAttribute('aria-label', 'AI 优化建议');
        btn.setAttribute('title', 'AI 优化建议');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1l1.5 3.5L13 5.5l-2.5 2.5L11 11.5 8 9.5l-3 2-0.5-3.5L2 5.5l3.5-1L8 1z"/></svg>';
        btn.dataset.aiField = 'skills';
        skillsContainer.appendChild(btn);
        skillsContainer.classList.add('skills-input--has-sparkle');
      }
    }
  }

  /** Get the current value for a field, handling special cases like skills */
  function getFieldValue(fieldEl) {
    const path = fieldEl.dataset.field || fieldEl.id;
    if (path === 'skills' || (fieldEl.id === 'skills-input')) {
      return resumeData.skills.join(', ');
    }
    return fieldEl.value;
  }

  /** Show suggestions panel below a field element */
  function showSuggestions(fieldEl, suggestions) {
    hideSuggestions(); // remove any existing panel

    if (!suggestions.length) return;

    const panel = document.createElement('div');
    panel.className = 'suggestion-panel';
    panel.innerHTML = '<div class="suggestion-panel__header">AI 建议</div>';

    suggestions.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'suggestion-card';

      const text = document.createElement('div');
      text.className = 'suggestion-card__text';
      text.textContent = s.text;
      card.appendChild(text);

      const actions = document.createElement('div');
      actions.className = 'suggestion-card__actions';

      if (s.type === 'replace' && s.replacement !== undefined) {
        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'suggestion-card__apply';
        applyBtn.textContent = '应用';
        applyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          fieldEl.value = s.replacement;
          fieldEl.dispatchEvent(new Event('input', { bubbles: true }));
          hideSuggestions();
        });
        actions.appendChild(applyBtn);
      } else if (s.type === 'append') {
        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'suggestion-card__apply';
        applyBtn.textContent = '应用';
        applyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // For textareas, append as a new line; for inputs, append with comma
          if (fieldEl.tagName === 'TEXTAREA') {
            fieldEl.value = fieldEl.value ? fieldEl.value + '\n' + s.text : s.text;
          } else {
            fieldEl.value = fieldEl.value ? fieldEl.value + ', ' + s.text : s.text;
          }
          fieldEl.dispatchEvent(new Event('input', { bubbles: true }));
          hideSuggestions();
        });
        actions.appendChild(applyBtn);
      }

      const dismissLink = document.createElement('button');
      dismissLink.type = 'button';
      dismissLink.className = 'suggestion-card__dismiss';
      dismissLink.textContent = '忽略';
      dismissLink.addEventListener('click', (e) => {
        e.stopPropagation();
        card.style.opacity = '0';
        card.style.transform = 'translateY(-4px)';
        card.style.transition = 'opacity 150ms ease-out, transform 150ms ease-out';
        setTimeout(() => {
          card.remove();
          // If no more cards, remove the panel
          if (!panel.querySelector('.suggestion-card')) {
            hideSuggestions();
          }
        }, 150);
      });
      actions.appendChild(dismissLink);

      card.appendChild(actions);
      panel.appendChild(card);
    });

    // Position the panel as fixed, below the field element
    // This escapes overflow:hidden clipping from parent containers
    const fieldContainer = fieldEl.closest('.field') || fieldEl.parentElement;
    document.body.appendChild(panel);

    // Calculate position from the field's bounding rect
    const rect = fieldEl.getBoundingClientRect();
    const rootStyle = getComputedStyle(document.documentElement);
    const suggestionMaxW = parseFloat(rootStyle.getPropertyValue('--suggestion-max-w')) || 22.5;
    panel.style.left = rect.left + 'px';
    panel.style.top = (rect.bottom + 4) + 'px';
    panel.style.width = Math.min(rect.width, suggestionMaxW * 16) + 'px';

    // Ensure panel doesn't overflow viewport bottom
    requestAnimationFrame(() => {
      const panelRect = panel.getBoundingClientRect();
      if (panelRect.bottom > window.innerHeight - 8) {
        // Flip above the field instead
        panel.style.top = (rect.top - panelRect.height - 4) + 'px';
      }
      // Ensure panel doesn't overflow viewport right
      if (panelRect.right > window.innerWidth - 8) {
        panel.style.left = (window.innerWidth - panelRect.width - 8) + 'px';
      }
      panel.classList.add('suggestion-panel--visible');
    });

    activeSuggestionPanel = panel;
  }

  /** Hide the active suggestion panel */
  function hideSuggestions() {
    if (activeSuggestionPanel) {
      activeSuggestionPanel.remove();
      activeSuggestionPanel = null;
    }
  }

  /** Handle sparkle button click */
  function handleSparkleClick(btn) {
    const fieldPath = btn.dataset.aiField;
    if (!fieldPath) return;

    // Find the corresponding field element
    let fieldEl;
    if (fieldPath === 'skills') {
      fieldEl = $('#skills-input');
    } else {
      fieldEl = $(`[data-field="${fieldPath}"]`, editor);
    }
    if (!fieldEl) return;

    const fieldType = getFieldAiType(fieldEl);
    if (!fieldType) return;

    const currentValue = getFieldValue(fieldEl);
    const suggestions = ResumeAdvisor.suggest(fieldType, currentValue);

    if (suggestions.length === 0) {
      // Show a "looks good" message briefly — use fixed positioning like showSuggestions
      const panel = document.createElement('div');
      panel.className = 'suggestion-panel suggestion-panel--visible';
      panel.innerHTML = '<div class="suggestion-panel__header">AI 建议</div><div class="suggestion-card"><div class="suggestion-card__text">当前内容看起来不错，暂无优化建议。</div></div>';
      document.body.appendChild(panel);

      // Position as fixed below the field
      const rect = fieldEl.getBoundingClientRect();
      panel.style.left = rect.left + 'px';
      panel.style.top = (rect.bottom + 4) + 'px';
      panel.style.width = Math.min(rect.width, 360) + 'px';

      // Check viewport overflow
      requestAnimationFrame(() => {
        const panelRect = panel.getBoundingClientRect();
        if (panelRect.bottom > window.innerHeight - 8) {
          panel.style.top = (rect.top - panelRect.height - 4) + 'px';
        }
      });

      activeSuggestionPanel = panel;
      setTimeout(hideSuggestions, 2500);
      return;
    }

    showSuggestions(fieldEl, suggestions);
  }

  // Close suggestions on outside click or Escape
  document.addEventListener('click', (e) => {
    if (activeSuggestionPanel && !activeSuggestionPanel.contains(e.target) && !e.target.closest('.ai-sparkle')) {
      hideSuggestions();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeSuggestionPanel) {
      hideSuggestions();
    }
  });

  // ============================================================
  // 10. PREVIEW SCALING
  // ============================================================

  /** Scale the pages container to fit within the preview panel */
  function scalePreview() {
    var container = previewCanvas.querySelector('.pages-container');
    if (!container) return;

    var canvasRect = previewCanvas.getBoundingClientRect();

    // Read padding from CSS variable instead of hardcoding
    var rootStyle = getComputedStyle(document.documentElement);
    var space6 = parseFloat(rootStyle.getPropertyValue('--space-6')) || 1.5;
    var paddingH = space6 * 16 * 2; // left + right padding
    var paddingV = space6 * 16 * 2; // top + bottom padding

    var availWidth = canvasRect.width - paddingH;
    var availHeight = canvasRect.height - paddingV;

    // Use the first page dimensions for scaling reference
    var firstPage = container.querySelector('.a4-page');
    if (!firstPage) return;

    var pageWidthPx = firstPage.offsetWidth;
    var pageHeightPx = firstPage.offsetHeight;

    if (!pageWidthPx || !pageHeightPx) return;

    // Calculate fit scale (auto-fit to preview canvas width, allow vertical scroll)
    var scaleX = availWidth / pageWidthPx;
    var scaleY = availHeight / pageHeightPx;
    var fitScale = Math.min(scaleX, scaleY, 1);

    // Determine effective scale based on zoom mode
    var scale;
    if (zoomMode === 'fit') {
      scale = fitScale;
    } else if (zoomMode === 'actual') {
      scale = 1;
    } else {
      // manual
      scale = manualZoom;
    }

    container.style.transform = 'scale(' + scale + ')';
    container.style.transformOrigin = 'top center';
    // Adjust container to account for scaled size so scrolling works correctly
    var containerHeight = container.offsetHeight;
    container.style.marginBottom = '-' + (containerHeight * (1 - scale)) + 'px';

    // Update zoom UI
    updateZoomUI(scale);
  }

  function updateZoomUI(scale) {
    const percent = Math.round(scale * 100);
    const zoomLabel = $('#zoom-label');
    const zoomSlider = $('#zoom-slider');
    if (zoomLabel) zoomLabel.textContent = percent + '%';
    if (zoomSlider) zoomSlider.value = Math.min(150, Math.max(30, percent));
  }

  function initZoomControls() {
    const zoomSlider = $('#zoom-slider');
    const btnZoomIn = $('#btn-zoom-in');
    const btnZoomOut = $('#btn-zoom-out');
    const btnZoomFit = $('#btn-zoom-fit');
    const btnZoomActual = $('#btn-zoom-actual');

    // Slider drag
    if (zoomSlider) {
      zoomSlider.addEventListener('input', () => {
        zoomMode = 'manual';
        manualZoom = parseInt(zoomSlider.value, 10) / 100;
        scalePreview();
      });
    }

    // Zoom in/out buttons
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        zoomMode = 'manual';
        manualZoom = Math.min(1.5, manualZoom + 0.1);
        scalePreview();
      });
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        zoomMode = 'manual';
        manualZoom = Math.max(0.3, manualZoom - 0.1);
        scalePreview();
      });
    }

    // Fit to window
    if (btnZoomFit) {
      btnZoomFit.addEventListener('click', () => {
        zoomMode = 'fit';
        scalePreview();
      });
    }

    // Actual size (100%)
    if (btnZoomActual) {
      btnZoomActual.addEventListener('click', () => {
        zoomMode = 'actual';
        scalePreview();
      });
    }

    // Ctrl+scroll to zoom
    previewCanvas.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomMode = 'manual';
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        manualZoom = Math.min(1.5, Math.max(0.3, manualZoom + delta));
        scalePreview();
      }
    }, { passive: false });
  }

  // ============================================================
  // 11. AI SERVICE — LLM Integration Layer
  // ============================================================

  const AIService = {
    apiKey: '',
    apiBase: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen3.6-27B',

    agentTools: [
      {
        type: 'function',
        function: {
          name: 'update_field',
          description: '更新简历中的某个字段值。可以修改个人信息、工作经历条目、教育背景条目、项目经历条目等。path格式：简单字段用字段名(如"name")，数组条目用"类型.索引.字段"(如"work.0.company")。',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '字段路径，如 "name", "title", "work.0.company", "work.0.description", "education.0.school", "skills" (技能用数组)' },
              value: { type: 'string', description: '要设置的新值。技能字段传JSON数组字符串如 "[\"Python\",\"SQL\"]"' }
            },
            required: ['path', 'value']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'add_entry',
          description: '在简历中添加一条新的工作经历、教育背景或项目经历。',
          parameters: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['work', 'education', 'projects'], description: '要添加的条目类型' },
              data: { type: 'object', description: '条目数据。work: {company,position,startDate,endDate,description}; education: {school,major,degree,startDate,endDate}; projects: {name,role,description,link}' }
            },
            required: ['type', 'data']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'remove_entry',
          description: '删除简历中的一条工作经历、教育背景或项目经历。',
          parameters: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['work', 'education', 'projects'], description: '条目类型' },
              index: { type: 'integer', description: '要删除的条目索引（从0开始）' }
            },
            required: ['type', 'index']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'batch_update',
          description: '批量更新多个字段。当需要同时修改多个字段时使用，比多次调用update_field更高效。',
          parameters: {
            type: 'object',
            properties: {
              updates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string', description: '字段路径' },
                    value: { type: 'string', description: '新值' }
                  },
                  required: ['path', 'value']
                },
                description: '要更新的字段列表'
              }
            },
            required: ['updates']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'read_resume',
          description: '读取当前简历的完整数据。在修改前应先读取，了解当前状态。',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'switch_template',
          description: '切换简历模板样式。',
          parameters: {
            type: 'object',
            properties: {
              template: { type: 'string', enum: ['classic', 'modern', 'creative'], description: '模板名称：classic=经典, modern=现代, creative=创意' }
            },
            required: ['template']
          }
        }
      }
      ,
      {
        type: 'function',
        function: {
          name: 'update_photo_style',
          description: '调整简历照片的位置和大小。position可选值：left(左侧)、right(右侧)、hidden(隐藏)；size可选值：small(小)、medium(中)、large(大)。',
          parameters: {
            type: 'object',
            properties: {
              position: {
                type: 'string',
                enum: ['left', 'right', 'hidden'],
                description: '照片位置'
              },
              size: {
                type: 'string',
                enum: ['small', 'medium', 'large'],
                description: '照片大小'
              }
            }
          }
        }
      }
    ],

    executeTool(toolName, args) {
      switch (toolName) {
        case 'update_field': {
          let value = args.value;
          if (args.path === 'skills') {
            try { value = JSON.parse(args.value); } catch (e) { value = args.value.split(/[,，、]/).map(function(s) { return s.trim(); }).filter(Boolean); }
          }
          setByPath(args.path, value);
          renderDynamicSections();
          attachSparkleButtons();
          renderPreview();
          return { success: true, message: '已更新字段 ' + args.path + ' 为: ' + (Array.isArray(value) ? value.join(', ') : value) };
        }
        case 'add_entry': {
          var type = args.type;
          var data = args.data || {};
          switch (type) {
            case 'work':
              resumeData.work.push({ company: data.company || '', position: data.position || '', startDate: data.startDate || '', endDate: data.endDate || '', description: data.description || '' });
              break;
            case 'education':
              resumeData.education.push({ school: data.school || '', major: data.major || '', degree: data.degree || '', startDate: data.startDate || '', endDate: data.endDate || '' });
              break;
            case 'projects':
              resumeData.projects.push({ name: data.name || '', role: data.role || '', description: data.description || '', link: data.link || '' });
              break;
          }
          renderDynamicSections();
          attachSparkleButtons();
          renderPreview();
          var typeLabels = { work: '工作', education: '教育', projects: '项目' };
          return { success: true, message: '已添加' + typeLabels[type] + '经历条目' };
        }
        case 'remove_entry': {
          var type = args.type;
          var index = args.index;
          var arr = resumeData[type];
          if (arr && arr.length > 1 && index >= 0 && index < arr.length) {
            arr.splice(index, 1);
            renderDynamicSections();
            attachSparkleButtons();
            renderPreview();
            var typeLabels = { work: '工作', education: '教育', projects: '项目' };
            return { success: true, message: '已删除' + typeLabels[type] + '经历第' + (index + 1) + '条' };
          }
          return { success: false, message: '无法删除：索引无效或只剩一条' };
        }
        case 'batch_update': {
          var results = [];
          (args.updates || []).forEach(function(u) {
            var value = u.value;
            if (u.path === 'skills') {
              try { value = JSON.parse(u.value); } catch (e) { value = u.value.split(/[,，、]/).map(function(s) { return s.trim(); }).filter(Boolean); }
            }
            setByPath(u.path, value);
            results.push(u.path + ': ' + (Array.isArray(value) ? value.join(', ') : value));
          });
          renderDynamicSections();
          attachSparkleButtons();
          renderPreview();
          return { success: true, message: '已批量更新 ' + results.length + ' 个字段', details: results };
        }
        case 'read_resume': {
          var dataCopy = JSON.parse(JSON.stringify(resumeData));
          dataCopy.photo = dataCopy.photo ? '[已上传照片]' : '[未上传照片]';
          return { success: true, data: dataCopy, template: currentTemplate, sectionOrder: sectionOrder.slice() };
        }
        case 'switch_template': {
          currentTemplate = args.template;
          var btnLabel = document.getElementById('btn-template-label');
          if (btnLabel) btnLabel.textContent = templateNames[currentTemplate] + '模板';
          var menuItems = document.querySelectorAll('.template-menu__item');
          menuItems.forEach(function(item) { item.classList.toggle('template-menu__item--active', item.dataset.template === currentTemplate); });
          renderPreview();
          scalePreview();
          return { success: true, message: '已切换到' + templateNames[currentTemplate] + '模板' };
        }
        case 'update_photo_style': {
          if (args.position) {
            resumeData.photoPosition = args.position;
            var posSelect = document.getElementById('photo-position');
            if (posSelect) posSelect.value = args.position;
          }
          if (args.size) {
            resumeData.photoSize = args.size;
            var sizeSelect = document.getElementById('photo-size');
            if (sizeSelect) sizeSelect.value = args.size;
          }
          renderPreview();
          var posLabels = { left: '左侧', right: '右侧', top: '顶部', hidden: '隐藏' };
          var sizeLabels = { small: '小', medium: '中', large: '大' };
          var feedback = [];
          if (args.position) feedback.push('位置: ' + posLabels[args.position]);
          if (args.size) feedback.push('大小: ' + sizeLabels[args.size]);
          return { success: true, message: '已调整照片' + feedback.join('，') };
        }
        default:
          return { success: false, message: '未知工具: ' + toolName };
      }
    },

    loadSettings() {
      try {
        const saved = localStorage.getItem('ai_settings');
        if (saved) {
          const s = JSON.parse(saved);
          this.apiKey = s.apiKey || '';
          this.apiBase = s.apiBase || 'https://api.siliconflow.cn/v1';
          this.model = s.model || 'Qwen/Qwen3.6-27B';
        }
      } catch (e) { /* ignore */ }
    },

    saveSettings() {
      try {
        localStorage.setItem('ai_settings', JSON.stringify({
          apiKey: this.apiKey,
          apiBase: this.apiBase,
          model: this.model
        }));
      } catch (e) { /* ignore */ }
    },

    async fetchModels() {
      if (!this.apiKey) {
        throw new Error('请先填写 API Key');
      }
      // SiliconFlow supports type/sub_type filtering; other providers ignore unknown params
      var url = this.apiBase + '/models';
      if (this.apiBase.indexOf('siliconflow') !== -1) {
        url += '?type=text&sub_type=chat';
      }
      var response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + this.apiKey
        }
      });
      if (!response.ok) {
        var errorText = await response.text();
        var errorMsg = '获取模型列表失败 (' + response.status + ')';
        try {
          var errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error?.message || errorMsg;
        } catch (e) { /* use default */ }
        throw new Error(errorMsg);
      }
      var data = await response.json();
      var models = (data.data || []).map(function(m) { return m.id; });
      // Sort alphabetically
      models.sort(function(a, b) { return a.localeCompare(b); });
      return models;
    },

    buildSystemPrompt(mode) {
      var prompt = '你是一位专业的简历撰写助手，服务于中国求职者。你会用中文回复。\n\n';
      prompt += '【核心原则 - 必须遵守】\n';
      prompt += '简历要质朴真实，不要吹牛。现在很多AI写的简历都在用"主导战略规划"、"搭建完整生态体系"、"全链路落地"、"统筹跨部门协作"等夸张词汇，HR一眼就能识别出是AI写的，直接淘汰。\n\n';
      prompt += '禁止使用的词汇（除非用户真的是高管级别）：\n';
      prompt += '- 主导战略、品牌战略、内容战略\n';
      prompt += '- 搭建生态体系、完整生态\n';
      prompt += '- 全链路落地、全链路打通\n';
      prompt += '- 统筹平台、统筹跨部门\n';
      prompt += '- 主导大型运营活动（应届生不可能做到）\n\n';
      prompt += '正确做法：\n';
      prompt += '- 写清楚具体做了哪些基础工作\n';
      prompt += '- 用量化数据说明成果（提升了多少、完成了多少）\n';
      prompt += '- 让HR能清楚了解你的能力模型\n';
      prompt += '- 体现每段经历之间的进步和成长\n';
      prompt += '- 如果用户描述过于夸张，要提醒用户并调整为合理表述\n\n';
      prompt += '你是一个智能代理(Agent)，可以直接通过工具调用来修改用户的简历数据，无需用户手动操作。\n\n';
      prompt += '可用工具说明：\n';
      prompt += '- read_resume: 读取当前简历完整数据。修改前应先调用此工具了解当前状态。\n';
      prompt += '- update_field: 更新单个字段。path格式：简单字段用字段名(如"name","title")，数组条目用"类型.索引.字段"(如"work.0.company","education.0.school")。技能字段传JSON数组字符串。\n';
      prompt += '- batch_update: 批量更新多个字段，比多次调用update_field更高效。\n';
      prompt += '- add_entry: 添加新的工作/教育/项目经历条目。\n';
      prompt += '- remove_entry: 删除指定的工作/教育/项目经历条目。\n';
      prompt += '- switch_template: 切换简历模板(classic/modern/creative)。\n';
      prompt += '- update_photo_style: 调整照片位置(left/right/hidden)和大小(small/medium/large)。\n\n';

      if (mode === 'generate') {
        prompt += '当前任务：用户会描述自己的背景信息，请根据描述生成完整的简历。\n';
        prompt += '操作步骤：\n';
        prompt += '1. 先调用read_resume了解当前简历状态\n';
        prompt += '2. 根据用户描述，使用batch_update一次性填充所有字段\n';
        prompt += '3. 如果需要添加多条工作/教育/项目经历，使用add_entry添加新条目，再用update_field填充\n';
        prompt += '4. 最后用自然语言简要说明你生成的简历亮点\n\n';
        prompt += '要求：\n';
        prompt += '1. 工作描述要具体，包含量化数据\n';
        prompt += '2. 每条工作描述用换行分隔不同要点，每行以"-"开头\n';
        prompt += '3. 日期格式为YYYY-MM\n';
        prompt += '4. 自我评价(selfEvaluation)控制在120个中文字以内，突出核心优势\n';
        prompt += '5. 技能特长(skills)如用户提供了语言能力或办公能力说明，请一并纳入\n';
      } else if (mode === 'optimize') {
        prompt += '当前任务：优化用户现有简历内容，使其更专业、更有说服力。\n';
        prompt += '操作步骤：\n';
        prompt += '1. 先调用read_resume读取当前简历数据\n';
        prompt += '2. 分析简历中可以优化的地方\n';
        prompt += '3. 使用update_field或batch_update逐个优化字段\n';
        prompt += '4. 最后用自然语言简要说明你做了哪些优化\n\n';
        prompt += '要求：\n';
        prompt += '1. 使用更专业的动词和措辞，但不要过度包装\n';
        prompt += '2. 添加量化数据（如果原文有暗示但未明确）\n';
        prompt += '3. 保持原有结构和核心信息不变\n';
        prompt += '4. 如果原文有夸张词汇（如"主导战略"、"搭建生态"），要降级为合理表述并提醒用户\n';
        prompt += '5. 优化的目标是让HR清楚了解能力模型，不是吹牛\n';
      } else if (mode === 'review') {
        prompt += '当前任务：审阅用户上传的简历文档，给出专业建议。不要评分，只提建议。\n';
        prompt += '请从以下角度分析简历：\n';
        prompt += '1. 内容完整性：是否缺少关键信息（联系方式、教育背景、工作经历等）\n';
        prompt += '2. 措辞专业性：是否有夸张、空洞或AI味重的表述\n';
        prompt += '3. 量化数据：工作成果是否有具体数字支撑\n';
        prompt += '4. 结构逻辑：经历是否有成长线，时间线是否连贯\n';
        prompt += '5. 针对性：简历内容是否与目标职位匹配\n\n';
        prompt += '输出格式：\n';
        prompt += '- 先简要概括简历的整体印象（2-3句话）\n';
        prompt += '- 然后逐条列出具体建议，每条建议要明确指出问题所在和改进方向\n';
        prompt += '- 如果发现夸张或AI味重的表述，直接引用原文并给出修改建议\n';
        prompt += '- 不要使用工具修改简历，只提供建议\n';
      } else {
        prompt += '当前任务：与用户对话，帮助撰写和修改简历。\n';
        prompt += '当用户提出修改简历的请求时：\n';
        prompt += '1. 先调用read_resume了解当前状态\n';
        prompt += '2. 使用update_field、batch_update、add_entry等工具直接修改简历\n';
        prompt += '3. 修改完成后用自然语言告知用户做了哪些修改\n';
        prompt += '如果只是普通对话，正常回复即可。\n';
      }

      return prompt;
    },

    async *streamChat(messages, options) {
      if (!this.apiKey) {
        throw new Error('请先在设置中配置 API Key');
      }

      this._reasoningStarted = false;

      var requestBody = {
        model: this.model,
        messages: messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096
      };

      // Pass tools if provided
      if (options && options.tools) {
        requestBody.tools = options.tools;
      }

      const response = await fetch(this.apiBase + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = 'API 请求失败 (' + response.status + ')';
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error?.message || errorMsg;
        } catch (e) { /* use default */ }
        throw new Error(errorMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Accumulator for tool calls across streaming chunks
      var toolCallsAccum = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            // Yield any accumulated tool calls before finishing
            var toolCallIds = Object.keys(toolCallsAccum);
            for (var i = 0; i < toolCallIds.length; i++) {
              var tc = toolCallsAccum[toolCallIds[i]];
              if (tc.name) {
                yield { type: 'tool_call', id: tc.id, name: tc.name, arguments: tc.arguments || '' };
              }
            }
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;
            const finishReason = choice?.finish_reason;

            if (delta) {
              // Handle reasoning content (Qwen3 thinking mode)
              const reasoning = delta.reasoning_content;
              const content = delta.content;

              if (reasoning) {
                if (!this._reasoningStarted) {
                  this._reasoningStarted = true;
                  yield { type: 'reasoning_start' };
                }
                yield { type: 'reasoning', text: reasoning };
              }

              if (content) {
                this._reasoningStarted = false;
                yield { type: 'content', text: content };
              }

              // Accumulate tool_call deltas
              if (delta.tool_calls) {
                for (var ti = 0; ti < delta.tool_calls.length; ti++) {
                  var tcDelta = delta.tool_calls[ti];
                  var tcId = tcDelta.id;
                  var tcIndex = tcDelta.index !== undefined ? tcDelta.index : 0;

                  if (!toolCallsAccum[tcIndex]) {
                    toolCallsAccum[tcIndex] = { id: '', name: '', arguments: '' };
                  }

                  if (tcId) {
                    toolCallsAccum[tcIndex].id = tcId;
                  }
                  if (tcDelta.function) {
                    if (tcDelta.function.name) {
                      toolCallsAccum[tcIndex].name = tcDelta.function.name;
                    }
                    if (tcDelta.function.arguments) {
                      toolCallsAccum[tcIndex].arguments += tcDelta.function.arguments;
                    }
                  }
                }
              }
            }

            // When finish_reason is 'tool_calls', yield all accumulated tool calls
            if (finishReason === 'tool_calls') {
              var tcKeys = Object.keys(toolCallsAccum);
              for (var ki = 0; ki < tcKeys.length; ki++) {
                var accTc = toolCallsAccum[tcKeys[ki]];
                if (accTc.name) {
                  yield { type: 'tool_call', id: accTc.id, name: accTc.name, arguments: accTc.arguments || '' };
                }
              }
              toolCallsAccum = {};
            }
          } catch (e) {
            // Skip malformed chunks
          }
        }
      }
    },

    parseResumeData(response) {
      const match = response.match(/```resume\s*\n?([\s\S]*?)\n?```/);
      if (!match) return null;
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        return null;
      }
    }
  };

  // Load settings on startup
  AIService.loadSettings();

  // ============================================================
  // 11b. FILE PARSER (PDF / DOCX)
  // ============================================================

  var FileParser = {
    _pdfLoaded: false,
    _mammothLoaded: false,

    _loadScript(url) {
      return new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = function() { reject(new Error('无法加载: ' + url)); };
        document.head.appendChild(script);
      });
    },

    async ensurePDF() {
      if (this._pdfLoaded && typeof pdfjsLib !== 'undefined') return;
      await this._loadScript('lib/pdf.min.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
      this._pdfLoaded = true;
    },

    async ensureMammoth() {
      if (this._mammothLoaded && typeof mammoth !== 'undefined') return;
      await this._loadScript('lib/mammoth.browser.min.js');
      this._mammothLoaded = true;
    },

    async extractText(file) {
      var name = file.name.toLowerCase();
      if (name.endsWith('.pdf')) {
        return await this.extractPDF(file);
      } else if (name.endsWith('.docx')) {
        return await this.extractDOCX(file);
      } else if (name.endsWith('.doc')) {
        throw new Error('暂不支持 .doc 格式，请将文件另存为 .docx 后重试');
      } else {
        throw new Error('不支持的文件格式，请上传 PDF 或 DOCX 文件');
      }
    },

    async extractPDF(file) {
      await this.ensurePDF();
      var arrayBuffer = await file.arrayBuffer();
      var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      var textParts = [];

      for (var i = 1; i <= pdf.numPages; i++) {
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        var pageText = content.items.map(function(item) { return item.str; }).join(' ');
        if (pageText.trim()) {
          textParts.push(pageText.trim());
        }
      }

      if (textParts.length === 0) {
        throw new Error('该 PDF 没有文字层（可能是扫描件），无法提取文字内容');
      }

      return textParts.join('\n');
    },

    async extractDOCX(file) {
      await this.ensureMammoth();
      var arrayBuffer = await file.arrayBuffer();
      var result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      var text = result.value.trim();
      if (!text) {
        throw new Error('该文档内容为空，无法提取文字');
      }
      return text;
    }
  };

  // ============================================================
  // 12. AI CHAT CONTROLLER
  // ============================================================

  const AIChat = {
    conversations: [],  // Array of { id, title, createdAt, updatedAt, messages }
    activeConversationId: null,
    messages: [],       // Shortcut: points to active conversation's messages
    isGenerating: false,
    currentMode: null,  // 'generate' | 'optimize' | 'review' | null
    MAX_CONVERSATIONS: 20,

    init() {
      const aiPanel = $('#ai-panel');
      const aiMessages = $('#ai-messages');
      const aiInput = $('#ai-input');
      const aiSend = $('#ai-send');
      const btnAiToggle = $('#btn-ai-toggle');
      const btnAiClose = $('#btn-ai-close');
      const btnAiSettings = $('#btn-ai-settings');
      const settingsDialog = $('#ai-settings-dialog');
      const settingsForm = $('#ai-settings-form');
      const btnSettingsCancel = $('#btn-settings-cancel');
      const btnToggleKey = $('#btn-toggle-key');

      // Load saved conversations
      this.loadConversations();
      if (!this.activeConversationId) {
        this.createConversation();
      }

      // Toggle AI panel
      btnAiToggle.addEventListener('click', () => {
        const isHidden = aiPanel.classList.contains('ai-panel--hidden');
        if (isHidden) {
          aiPanel.classList.remove('ai-panel--hidden');
          btnAiToggle.classList.add('btn--ai-active');
        } else {
          aiPanel.classList.add('ai-panel--hidden');
          btnAiToggle.classList.remove('btn--ai-active');
        }
        // Re-scale preview after layout change
        setTimeout(scalePreview, 300);
      });

      // Close AI panel
      btnAiClose.addEventListener('click', () => {
        aiPanel.classList.add('ai-panel--hidden');
        btnAiToggle.classList.remove('btn--ai-active');
        setTimeout(scalePreview, 300);
      });

      // Send message
      aiSend.addEventListener('click', () => this.sendUserMessage());
      aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendUserMessage();
        }
      });

      // Auto-resize textarea
      aiInput.addEventListener('input', () => {
        aiInput.style.height = 'auto';
        const maxInputH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ai-input-max-h') || '7.5') * 16;
    aiInput.style.height = Math.min(aiInput.scrollHeight, maxInputH) + 'px';
      });

      // Quick actions
      $$('.ai-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          this.handleQuickAction(action);
        });
      });

      // Settings dialog
      btnAiSettings.addEventListener('click', () => {
        this.openSettings();
        settingsDialog.showModal();
      });

      btnSettingsCancel.addEventListener('click', () => {
        settingsDialog.close();
      });

      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettingsFromForm();
        settingsDialog.close();
      });

      // Click outside dialog to close
      settingsDialog.addEventListener('click', (e) => {
        if (e.target === settingsDialog) {
          settingsDialog.close();
        }
      });

      // Toggle API key visibility
      btnToggleKey.addEventListener('click', () => {
        const keyInput = $('#settings-api-key');
        keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
      });

      // Scan models button
      var btnScanModels = $('#btn-scan-models');
      if (btnScanModels) {
        btnScanModels.addEventListener('click', () => {
          this.scanModels();
        });
      }

      // New conversation button
      var btnNewChat = $('#btn-ai-new-chat');
      if (btnNewChat) {
        btnNewChat.addEventListener('click', () => {
          this.startNewConversation();
        });
      }

      // History button
      var btnHistory = $('#btn-ai-history');
      var historyEl = $('#ai-history');
      if (btnHistory && historyEl) {
        btnHistory.addEventListener('click', () => {
          this.renderHistoryList();
          historyEl.togglePopover();
          requestAnimationFrame(() => {
            var btnRect = btnHistory.getBoundingClientRect();
            var panelRect = aiPanel.getBoundingClientRect();
            historyEl.style.top = (btnRect.bottom + 4) + 'px';
            historyEl.style.right = (panelRect.right - btnRect.right) + 'px';
            historyEl.style.left = 'auto';
          });
        });
      }

      // Restore chat messages or show welcome
      if (this.messages.length > 0) {
        this.renderChatMessages();
      } else {
        this.addSystemMessage('你好！我是AI简历助手，可以帮你撰写和优化简历。');
      }
    },

    openSettings() {
      $('#settings-api-base').value = AIService.apiBase;
      $('#settings-api-key').value = AIService.apiKey;
      $('#settings-model').value = AIService.model;
      // Clear and hide previous model list
      var listEl = $('#ai-model-list');
      if (listEl) {
        listEl.innerHTML = '';
        listEl.classList.add('ai-model-list--hidden');
      }
    },

    // --- Conversation Management ---

    createConversation() {
      var conv = {
        id: Date.now().toString(),
        title: '新对话',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
      };
      this.conversations.unshift(conv);
      this.activeConversationId = conv.id;
      this.messages = conv.messages;
      // Trim old conversations
      if (this.conversations.length > this.MAX_CONVERSATIONS) {
        this.conversations = this.conversations.slice(0, this.MAX_CONVERSATIONS);
      }
      this.saveConversations();
      return conv;
    },

    switchConversation(id) {
      var conv = this.conversations.find(function(c) { return c.id === id; });
      if (!conv) return;
      this.activeConversationId = id;
      this.messages = conv.messages;
      this.renderChatMessages();
      this.saveConversations();
    },

    deleteConversation(id) {
      var idx = this.conversations.findIndex(function(c) { return c.id === id; });
      if (idx === -1) return;
      this.conversations.splice(idx, 1);
      if (this.activeConversationId === id) {
        if (this.conversations.length > 0) {
          this.switchConversation(this.conversations[0].id);
        } else {
          this.createConversation();
          this.renderChatMessages();
        }
      }
      this.saveConversations();
      this.renderHistoryList();
    },

    getActiveConversation() {
      return this.conversations.find(function(c) { return c.id === this.activeConversationId; }.bind(this)) || null;
    },

    saveConversations() {
      try {
        localStorage.setItem('ai_conversations', JSON.stringify(this.conversations));
        localStorage.setItem('ai_active_conversation', this.activeConversationId || '');
      } catch (e) { /* ignore quota errors */ }
    },

    loadConversations() {
      try {
        var saved = localStorage.getItem('ai_conversations');
        if (saved) {
          this.conversations = JSON.parse(saved);
          // Validate structure
          if (!Array.isArray(this.conversations)) this.conversations = [];
        }
        var activeId = localStorage.getItem('ai_active_conversation');
        if (activeId && this.conversations.find(function(c) { return c.id === activeId; })) {
          this.activeConversationId = activeId;
        } else if (this.conversations.length > 0) {
          this.activeConversationId = this.conversations[0].id;
        }
        if (this.activeConversationId) {
          var conv = this.getActiveConversation();
          if (conv) {
            this.messages = conv.messages;
          }
        }
      } catch (e) {
        this.conversations = [];
      }
    },

    updateConversationTitle() {
      var conv = this.getActiveConversation();
      if (!conv) return;
      // Auto-title from first user message
      if (conv.title === '新对话') {
        for (var i = 0; i < conv.messages.length; i++) {
          if (conv.messages[i].role === 'user') {
            conv.title = conv.messages[i].content.substring(0, 20);
            if (conv.messages[i].content.length > 20) conv.title += '...';
            break;
          }
        }
      }
      conv.updatedAt = new Date().toISOString();
      this.saveConversations();
    },

    renderChatMessages() {
      var container = $('#ai-messages');
      container.innerHTML = '';
      var conv = this.getActiveConversation();
      if (!conv) return;
      conv.messages.forEach(function(m) {
        var el = document.createElement('div');
        if (m.role === 'user') {
          el.className = 'ai-msg ai-msg--user';
          el.textContent = m.content;
        } else if (m.role === 'assistant') {
          el.className = 'ai-msg ai-msg--ai';
          el.innerHTML = this.formatMessageText(m.content);
        } else if (m.role === 'system') {
          el.className = 'ai-msg ai-msg--system';
          el.textContent = m.content;
        }
        container.appendChild(el);
      }.bind(this));
      this.scrollToBottom();
    },

    renderHistoryList() {
      var listEl = $('#ai-history-list');
      if (!listEl) return;
      listEl.innerHTML = '';
      if (this.conversations.length === 0) {
        listEl.innerHTML = '<div class="ai-history__empty">暂无历史对话</div>';
        return;
      }
      this.conversations.forEach(function(conv) {
        var item = document.createElement('div');
        item.className = 'ai-history__item' + (conv.id === this.activeConversationId ? ' ai-history__item--active' : '');
        item.dataset.id = conv.id;

        var info = document.createElement('div');
        info.className = 'ai-history__item-info';

        var title = document.createElement('div');
        title.className = 'ai-history__item-title';
        title.textContent = conv.title;

        var date = document.createElement('div');
        date.className = 'ai-history__item-date';
        var d = new Date(conv.updatedAt || conv.createdAt);
        date.textContent = d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

        info.appendChild(title);
        info.appendChild(date);
        item.appendChild(info);

        var delBtn = document.createElement('button');
        delBtn.className = 'ai-history__item-delete';
        delBtn.title = '删除';
        delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
        delBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          this.deleteConversation(conv.id);
        }.bind(this));
        item.appendChild(delBtn);

        item.addEventListener('click', function() {
          this.switchConversation(conv.id);
          this.renderHistoryList();
          // Close the popover
          var historyEl = $('#ai-history');
          if (historyEl) historyEl.hidePopover();
        }.bind(this));

        listEl.appendChild(item);
      }.bind(this));
    },

    startNewConversation() {
      if (this.isGenerating) return;
      this.createConversation();
      // Clear chat display
      var container = $('#ai-messages');
      container.innerHTML = '';
      this.addSystemMessage('你好！我是AI简历助手，可以帮你撰写和优化简历。');
      this.renderHistoryList();
    },

    saveSettingsFromForm() {
      AIService.apiBase = $('#settings-api-base').value.trim() || 'https://api.openai.com/v1';
      AIService.apiKey = $('#settings-api-key').value.trim();
      AIService.model = $('#settings-model').value.trim() || 'gpt-4o-mini';
      AIService.saveSettings();
      this.addSystemMessage('API 设置已保存');
    },

    async scanModels() {
      var btn = $('#btn-scan-models');
      var listEl = $('#ai-model-list');

      // Temporarily save form values so fetchModels uses current API base/key
      var tempBase = $('#settings-api-base').value.trim();
      var tempKey = $('#settings-api-key').value.trim();
      if (tempBase) AIService.apiBase = tempBase;
      if (tempKey) AIService.apiKey = tempKey;

      // Show loading state
      btn.disabled = true;
      btn.classList.add('ai-settings-dialog__scan-btn--loading');
      listEl.classList.remove('ai-model-list--hidden');
      listEl.innerHTML = '<div class="ai-model-list__loading">扫描中...</div>';

      try {
        var models = await AIService.fetchModels();
        if (models.length === 0) {
          listEl.innerHTML = '<div class="ai-model-list__empty">未找到可用模型</div>';
          return;
        }
        // Render model list
        var html = '';
        models.forEach(function(id) {
          html += '<button type="button" class="ai-model-list__item" data-model="' + esc(id) + '">' + esc(id) + '</button>';
        });
        listEl.innerHTML = html;

        // Bind click events to select model
        var items = listEl.querySelectorAll('.ai-model-list__item');
        items.forEach(function(item) {
          item.addEventListener('click', function() {
            $('#settings-model').value = item.dataset.model;
            // Highlight selected
            items.forEach(function(i) { i.classList.remove('ai-model-list__item--active'); });
            item.classList.add('ai-model-list__item--active');
          });
        });

        // Highlight current model if it's in the list
        var currentModel = $('#settings-model').value.trim();
        if (currentModel) {
          items.forEach(function(item) {
            if (item.dataset.model === currentModel) {
              item.classList.add('ai-model-list__item--active');
            }
          });
        }
      } catch (error) {
        listEl.innerHTML = '<div class="ai-model-list__error">' + esc(error.message) + '</div>';
      } finally {
        btn.disabled = false;
        btn.classList.remove('ai-settings-dialog__scan-btn--loading');
      }
    },

    handleQuickAction(action) {
      if (this.isGenerating) return;

      // Check if API key is configured
      if (!AIService.apiKey) {
        this.addSystemMessage('请先在设置中配置 API Key');
        $('#ai-settings-dialog').showModal();
        this.openSettings();
        return;
      }

      switch (action) {
        case 'generate':
          this.currentMode = 'generate';
          if (this.isResumeEmpty()) {
            this.addAIMessage('请告诉我你的背景信息，我来帮你生成一份专业简历。你可以描述：\n\n1) 目标职位\n2) 工作经历\n3) 教育背景\n4) 技能特长');
          } else {
            this.sendToAI('请根据我现有的简历信息，补充完善并生成一份更专业的完整简历。', 'generate');
          }
          break;
        case 'optimize':
          this.currentMode = 'optimize';
          if (this.isResumeEmpty()) {
            this.addAIMessage('简历内容为空，请先填写一些基本信息，或者使用"一键生成"功能。');
            this.currentMode = null;
            return;
          }
          this.sendToAI('请优化我的简历内容', 'optimize');
          break;
        case 'review':
          // Dynamically create file input to avoid browser security restrictions
          var input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.docx,.doc';
          input.style.display = 'none';
          document.body.appendChild(input);
          input.addEventListener('change', (e) => {
            this.handleFileUpload(e);
            document.body.removeChild(input);
          });
          input.click();
          break;
      }
    },

    isResumeEmpty() {
      const d = resumeData;
      return !d.name && !d.title && !d.selfEvaluation &&
        d.work.every(w => !w.company && !w.position && !w.description) &&
        d.education.every(e => !e.school && !e.major) &&
        d.skills.length === 0 &&
        d.projects.every(p => !p.name && !p.description);
    },

    async handleFileUpload(event) {
      var file = event.target.files[0];
      // Reset input so same file can be re-uploaded
      event.target.value = '';

      if (!file) {
        this.currentMode = null;
        return;
      }

      this.currentMode = 'review';
      var fileName = file.name;
      this.addUserMessage('上传文件：' + fileName);

      try {
        var text = await FileParser.extractText(file);

        // Truncate if too long (most APIs have context limits)
        var maxLen = 8000;
        if (text.length > maxLen) {
          text = text.substring(0, maxLen) + '\n\n[... 文档内容过长，已截断 ...]';
        }

        this.sendToAI('请审阅以下简历内容，给出专业建议（不要评分）：\n\n---\n' + text + '\n---', 'review');
      } catch (error) {
        this.addAIMessage('文件读取失败：' + error.message);
        this.currentMode = null;
      }
    },

    sendUserMessage() {
      const aiInput = $('#ai-input');
      const text = aiInput.value.trim();
      if (!text || this.isGenerating) return;

      aiInput.value = '';
      aiInput.style.height = 'auto';

      this.addUserMessage(text);

      // Determine mode
      const mode = this.currentMode || 'chat';
      this.sendToAI(text, mode);
    },

    async sendToAI(userText, mode) {
      if (this.isGenerating) return;
      this.isGenerating = true;

      // Build messages array for API
      const systemPrompt = AIService.buildSystemPrompt(mode);
      var apiMessages = [
        { role: 'system', content: systemPrompt }
      ];

      // Include recent chat history (last 10 messages for context)
      const recentMessages = this.messages.slice(-10);
      recentMessages.forEach(function(m) {
        if (m.role === 'user' || m.role === 'assistant') {
          var msg = { role: m.role, content: m.content };
          // SiliconFlow thinking models require reasoning_content to be passed back
          if (m.role === 'assistant' && m.reasoning_content) {
            msg.reasoning_content = m.reasoning_content;
          }
          apiMessages.push(msg);
        }
      });

      // Add the current user message
      apiMessages.push({ role: 'user', content: userText });

      // Determine if agent mode should be used (with tools)
      var useAgentMode = (mode === 'generate' || mode === 'optimize' || mode === 'chat');
      var streamOptions = useAgentMode ? { tools: AIService.agentTools } : {};

      // Show typing indicator
      const typingEl = this.showTypingIndicator();

      // Create AI message element for streaming
      var aiMsgEl = this.createAIMessageElement();
      var fullResponse = '';
      var lastReasoningContent = '';
      var MAX_AGENT_ITERATIONS = 10;

      try {
        for (var iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration++) {
          var stream = AIService.streamChat(apiMessages, streamOptions);
          var firstChunk = true;
          var isThinking = false;
          var reasoningContent = '';
          var toolCalls = [];
          var textContent = '';

          for await (var chunk of stream) {
            if (firstChunk) {
              this.removeTypingIndicator(typingEl);
              firstChunk = false;
            }

            // Handle new object-based yield format
            if (typeof chunk === 'object' && chunk !== null) {
              if (chunk.type === 'reasoning_start') {
                isThinking = true;
                reasoningContent = '';
                this.updateAIMessageContent(aiMsgEl, '<div class="ai-reasoning">思考中...</div>');
                continue;
              }

              if (chunk.type === 'reasoning') {
                isThinking = true;
                reasoningContent += chunk.text;
                this.updateAIMessageContent(aiMsgEl, '<div class="ai-reasoning">' + this.formatReasoningText(reasoningContent) + '</div>');
                continue;
              }

              if (chunk.type === 'content') {
                if (isThinking) {
                  isThinking = false;
                  textContent = '';
                  // Show separator between reasoning and answer
                  if (reasoningContent) {
                    fullResponse = '<div class="ai-reasoning">' + this.formatReasoningText(reasoningContent) + '</div><div class="ai-reasoning-sep"></div>';
                  }
                  var trimmedText = chunk.text.replace(/^\s+/, '');
                  if (trimmedText) {
                    textContent = trimmedText;
                    fullResponse += trimmedText;
                    this.updateAIMessageContent(aiMsgEl, fullResponse);
                  }
                  continue;
                }
                textContent += chunk.text;
                fullResponse += chunk.text;
                this.updateAIMessageContent(aiMsgEl, fullResponse);
                continue;
              }

              if (chunk.type === 'tool_call') {
                toolCalls.push({
                  id: chunk.id,
                  name: chunk.name,
                  arguments: chunk.arguments
                });
                continue;
              }
            }

            // Legacy string-based format (backward compat)
            if (typeof chunk === 'string') {
              if (chunk === '\u200B') {
                isThinking = true;
                reasoningContent = '';
                this.updateAIMessageContent(aiMsgEl, '<div class="ai-reasoning">思考中...</div>');
                continue;
              }

              if (isThinking) {
                isThinking = false;
                fullResponse = '';
                if (reasoningContent) {
                  fullResponse = '<div class="ai-reasoning">' + this.formatReasoningText(reasoningContent) + '</div><div class="ai-reasoning-sep"></div>';
                }
                var trimmedChunk = chunk.replace(/^\s+/, '');
                if (trimmedChunk) {
                  fullResponse += trimmedChunk;
                  textContent = trimmedChunk;
                  this.updateAIMessageContent(aiMsgEl, fullResponse);
                }
                continue;
              }

              fullResponse += chunk;
              textContent += chunk;
              this.updateAIMessageContent(aiMsgEl, fullResponse);
            }
          }

          if (firstChunk) {
            this.removeTypingIndicator(typingEl);
          }

          // If no tool calls, this is the final response — break the loop
          if (toolCalls.length === 0) {
            break;
          }

          // --- Agent loop: process tool calls ---

          // Add assistant message with tool_calls to conversation
          var assistantMsg = {
            role: 'assistant',
            content: textContent || null,
            tool_calls: toolCalls.map(function(tc) {
              return {
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.arguments
                }
              };
            })
          };
          // SiliconFlow thinking models require reasoning_content to be passed back
          if (reasoningContent) {
            assistantMsg.reasoning_content = reasoningContent;
          }
          apiMessages.push(assistantMsg);

          // Execute each tool call and add results
          for (var tci = 0; tci < toolCalls.length; tci++) {
            var tc = toolCalls[tci];
            var toolArgs;
            try {
              toolArgs = JSON.parse(tc.arguments);
            } catch (e) {
              toolArgs = {};
            }

            // Show tool execution feedback in chat
            var feedbackMsg = this.getToolFeedback(tc.name, toolArgs);
            if (feedbackMsg) {
              this.addSystemMessage(feedbackMsg);
            }

            // Execute the tool
            var toolResult = AIService.executeTool(tc.name, toolArgs);

            // Add tool result message
            apiMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(toolResult)
            });
          }

          // Sync editor from data after tool execution
          this.syncEditorFromData();

          // Save reasoning content from this iteration before resetting
          if (reasoningContent) {
            lastReasoningContent = reasoningContent;
          }

          // Reset for next iteration — create a new AI message element for the follow-up response
          aiMsgEl = this.createAIMessageElement();
          fullResponse = '';
        }

        // Store the final text response (with reasoning_content for thinking models)
        var storedMsg = { role: 'assistant', content: fullResponse };
        if (reasoningContent || lastReasoningContent) {
          storedMsg.reasoning_content = reasoningContent || lastReasoningContent;
        }
        this.messages.push(storedMsg);
        this.updateConversationTitle();
        this.saveConversations();

        // Check for resume data to apply (fallback for non-agent responses)
        const parsedResume = AIService.parseResumeData(fullResponse);
        if (parsedResume) {
          this.addApplyButton(aiMsgEl, parsedResume);
        }

      } catch (error) {
        this.removeTypingIndicator(typingEl);
        if (aiMsgEl.parentNode) {
          aiMsgEl.remove();
        }
        this.addSystemMessage('请求失败：' + error.message);
      }

      this.isGenerating = false;
      this.currentMode = null;
    },

    getToolFeedback(toolName, args) {
      switch (toolName) {
        case 'update_field':
          return '正在更新：' + args.path + ' = ' + (args.value || '');
        case 'add_entry':
          var typeLabels = { work: '工作', education: '教育', projects: '项目' };
          return '正在添加' + (typeLabels[args.type] || args.type) + '经历条目';
        case 'remove_entry':
          var typeLabels2 = { work: '工作', education: '教育', projects: '项目' };
          return '正在删除' + (typeLabels2[args.type] || args.type) + '经历第' + ((args.index || 0) + 1) + '条';
        case 'batch_update':
          return '正在批量更新 ' + ((args.updates || []).length) + ' 个字段';
        case 'read_resume':
          return '正在读取简历数据...';
        case 'switch_template':
          var templateLabels = { classic: '经典', modern: '现代', creative: '创意' };
          return '正在切换到' + (templateLabels[args.template] || args.template) + '模板';
        default:
          return null;
      }
    },

    // --- Message Rendering ---

    addSystemMessage(text) {
      this.messages.push({ role: 'system', content: text });
      const container = $('#ai-messages');
      const el = document.createElement('div');
      el.className = 'ai-msg ai-msg--system';
      el.textContent = text;
      container.appendChild(el);
      this.scrollToBottom();
      this.updateConversationTitle();
      this.saveConversations();
    },

    addUserMessage(text) {
      this.messages.push({ role: 'user', content: text });
      const container = $('#ai-messages');
      const el = document.createElement('div');
      el.className = 'ai-msg ai-msg--user';
      el.textContent = text;
      container.appendChild(el);
      this.scrollToBottom();
      this.updateConversationTitle();
      this.saveConversations();
    },

    addAIMessage(text) {
      this.messages.push({ role: 'assistant', content: text });
      const container = $('#ai-messages');
      const el = document.createElement('div');
      el.className = 'ai-msg ai-msg--ai';
      el.innerHTML = this.formatMessageText(text);
      container.appendChild(el);
      this.scrollToBottom();
      this.updateConversationTitle();
      this.saveConversations();
    },

    createAIMessageElement() {
      const container = $('#ai-messages');
      const el = document.createElement('div');
      el.className = 'ai-msg ai-msg--ai';
      el.innerHTML = '';
      container.appendChild(el);
      this.scrollToBottom();
      return el;
    },

    updateAIMessageContent(el, text) {
      // Check if this is a thinking indicator (raw HTML, not user content)
      if (text.startsWith('<span class="ai-thinking-indicator">')) {
        el.innerHTML = text;
      } else if (text.indexOf('<div class="ai-reasoning">') !== -1) {
        // Content has reasoning blocks — split into reasoning (raw HTML) and text (escaped)
        var parts = text.split('<div class="ai-reasoning-sep"></div>');
        var reasoningHtml = parts[0] || '';
        var textContent = parts[1] || '';
        el.innerHTML = reasoningHtml + this.formatMessageText(textContent);
      } else {
        el.innerHTML = this.formatMessageText(text);
      }
      this.scrollToBottom();
    },

    formatMessageText(text) {
      // Simple formatting: escape HTML, then convert newlines, then handle code blocks
      let html = esc(text);
      // Convert ```...``` code blocks
      html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="ai-code-block">$2</pre>');
      // Convert newlines outside of pre tags
      html = html.replace(/\n/g, '<br>');
      return html;
    },

    formatReasoningText(text) {
      let html = esc(text);
      // Filter out AI-generated HTML tag artifacts (the AI sometimes outputs these in reasoning)
      html = html.replace(/&lt;div class="ai-reasoning[^"]*"&gt;/gi, '');
      html = html.replace(/&lt;div class="ai-reasoning-sep"&gt;&lt;\/div&gt;/gi, '');
      html = html.replace(/&lt;\/div&gt;/gi, '');
      // Convert ```...``` code blocks
      html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="ai-code-block">$2</pre>');
      // Convert **bold** and __bold__
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
      // Convert *italic* and _italic_
      html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
      html = html.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
      // Convert `inline code`
      html = html.replace(/`([^`]+)`/g, '<code style="background:var(--neutral-3);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>');
      // Convert bullet lists: - or * at start of line
      html = html.replace(/^[\s]*[-*]\s+(.+)$(?:[\n]?)/gm, '<li style="margin-left:1.2em;list-style-type:disc">$1</li>');
      // Convert numbered lists: 1. 2. etc
      html = html.replace(/^[\s]*\d+\.\s+(.+)$(?:[\n]?)/gm, '<li style="margin-left:1.2em;list-style-type:decimal">$1</li>');
      // Wrap consecutive <li> in <ul>/<ol> — simple approach: wrap in a div
      html = html.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/g, '<ul style="padding:0;margin:4px 0">$1</ul>');
      // Convert newlines
      html = html.replace(/\n/g, '<br>');
      // Clean up any <br> right after <ul> or before </ul>
      html = html.replace(/<ul[^>]*>\s*<br>\s*/g, '<ul>');
      html = html.replace(/\s*<br>\s*<\/ul>/g, '</ul>');
      return html;
    },

    addApplyButton(msgEl, data) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-msg__apply';
      btn.textContent = '✓ 应用到简历';
      btn.addEventListener('click', () => {
        this.applyResumeData(data);
        btn.textContent = '✓ 已应用';
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'default';
      });
      msgEl.appendChild(btn);
    },

    // --- Typing Indicator ---

    showTypingIndicator() {
      const container = $('#ai-messages');
      const el = document.createElement('div');
      el.className = 'ai-msg ai-msg--typing';
      el.innerHTML = '<span class="ai-typing-dot"></span><span class="ai-typing-dot"></span><span class="ai-typing-dot"></span>';
      container.appendChild(el);
      this.scrollToBottom();
      return el;
    },

    removeTypingIndicator(el) {
      if (el && el.parentNode) {
        el.remove();
      }
    },

    // --- Auto-Fill ---

    applyResumeData(data) {
      // Merge AI data into resumeData
      // For simple fields, only overwrite if AI provided non-empty value
      const simpleFields = ['name', 'title', 'phone', 'email', 'address', 'workYears', 'expectedSalary', 'availability', 'selfEvaluation'];
      simpleFields.forEach(field => {
        if (data[field] !== undefined && data[field] !== '') {
          resumeData[field] = data[field];
        }
      });

      // For arrays, replace if AI provided non-empty arrays
      if (data.work && Array.isArray(data.work) && data.work.length > 0) {
        // Only replace entries that have content
        const hasAnyContent = data.work.some(w => w.company || w.position || w.description);
        if (hasAnyContent) {
          resumeData.work = data.work.map(w => ({
            company: w.company || '',
            position: w.position || '',
            startDate: w.startDate || '',
            endDate: w.endDate || '',
            description: w.description || ''
          }));
        }
      }

      if (data.education && Array.isArray(data.education) && data.education.length > 0) {
        const hasAnyContent = data.education.some(e => e.school || e.major);
        if (hasAnyContent) {
          resumeData.education = data.education.map(e => ({
            school: e.school || '',
            major: e.major || '',
            degree: e.degree || '',
            startDate: e.startDate || '',
            endDate: e.endDate || ''
          }));
        }
      }

      if (data.skills && Array.isArray(data.skills) && data.skills.length > 0) {
        resumeData.skills = data.skills;
      }

      if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
        const hasAnyContent = data.projects.some(p => p.name || p.description);
        if (hasAnyContent) {
          resumeData.projects = data.projects.map(p => ({
            name: p.name || '',
            role: p.role || '',
            description: p.description || '',
            link: p.link || ''
          }));
        }
      }

      // Update editor fields
      this.syncEditorFromData();
      renderPreview();
    },

    syncEditorFromData() {
      // Update simple fields
      const simpleFields = ['name', 'title', 'phone', 'email', 'address', 'workYears', 'expectedSalary', 'availability', 'selfEvaluation'];
      simpleFields.forEach(field => {
        const input = $('#' + field);
        if (input && resumeData[field]) {
          if (input.value !== resumeData[field]) {
            input.value = resumeData[field];
            this.highlightField(input);
          }
        }
      });

      // Sync photo preview
      updatePhotoPreview();

      // Re-render dynamic sections (work, education, projects)
      renderDynamicSections();
      attachSparkleButtons();

      // Highlight all visible inputs after a brief delay for DOM update
      requestAnimationFrame(() => {
        const inputs = $$('.field__input, .field__textarea', editor);
        inputs.forEach(input => {
          if (input.value && input.value.trim()) {
            this.highlightField(input);
          }
        });
      });
    },

    highlightField(el) {
      el.classList.remove('highlight');
      // Force reflow to restart animation
      void el.offsetWidth;
      el.classList.add('highlight');
      el.addEventListener('animationend', () => {
        el.classList.remove('highlight');
      }, { once: true });
    },

    // --- Utility ---

    scrollToBottom() {
      const container = $('#ai-messages');
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  };

  // ============================================================
  // 10. INITIALIZATION (updated)
  // ============================================================

  function init() {
    // Restore last auto-saved state
    ResumeManager.restoreAuto();

    renderDynamicSections();
    attachSparkleButtons();
    initPhotoUpload();
    renderPreview();
    initEvents();
    initDragAndDrop();
    initZoomControls();
    AIChat.init();

    // Initial scale after a brief delay for layout
    requestAnimationFrame(() => {
      scalePreview();
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
