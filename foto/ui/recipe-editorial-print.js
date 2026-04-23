(function(){
function escapeHtml(value){
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function absoluteUrl(value){
      try{ return new URL(value, document.baseURI).href; }catch(e){ return value || ''; }
    }

    function nodeHtmlWithoutLinks(node){
      if(!node) return '';
      var clone = node.cloneNode(true);
      clone.querySelectorAll('a').forEach(function(a){
        var span = document.createElement('span');
        span.innerHTML = a.innerHTML;
        a.replaceWith(span);
      });
      clone.querySelectorAll('img').forEach(function(img){
        img.setAttribute('src', absoluteUrl(img.getAttribute('src') || img.currentSrc || ''));
      });
      clone.querySelectorAll('figure').forEach(function(fig){
        fig.removeAttribute('style');
        fig.classList.remove('step-photo-left','step-photo-right','step-photo-large','print-figure-large','print-figure-small');
        if(fig.classList.contains('step-photo-large')) fig.classList.add('print-figure-large');
        else fig.classList.add('print-figure-small');
      });
      clone.querySelectorAll('h2,h3').forEach(function(h){ h.remove(); });
      return clone.innerHTML;
    }

    function classifyFigure(fig){
      var clone = fig.cloneNode(true);
      clone.querySelectorAll('a').forEach(function(a){
        var span = document.createElement('span');
        span.innerHTML = a.innerHTML;
        a.replaceWith(span);
      });
      clone.querySelectorAll('img').forEach(function(img){
        img.setAttribute('src', absoluteUrl(img.getAttribute('src') || img.currentSrc || ''));
      });
      var classes = clone.classList;
      if(classes.contains('step-photo-large')) clone.classList.add('print-figure-large');
      else clone.classList.add('print-figure-small');
      return clone.outerHTML;
    }

    function collectSectionHtml(section, opts){
      if(!section) return '';
      opts = opts || {};
      var fragments = [];
      Array.from(section.children).forEach(function(child){
        if(!child || !child.tagName) return;
        var tag = child.tagName.toLowerCase();
        if(tag === 'h2' || tag === 'h3') return;
        if(tag === 'figure'){
          fragments.push(classifyFigure(child));
          return;
        }
        fragments.push(nodeHtmlWithoutLinks(child));
      });
      var cls = opts.cls ? ' ' + opts.cls : '';
      return '<section class="print-section'+cls+'">' + fragments.join('') + '</section>';
    }

    function collectIntroHtml(section){
      if(!section) return '';
      var blocks = [];
      Array.from(section.children).forEach(function(child){
        if(!child || !child.tagName) return;
        var tag = child.tagName.toLowerCase();
        if(tag === 'h2' || tag === 'h3') return;
        if(tag === 'figure'){
          blocks.push(classifyFigure(child));
          return;
        }
        if(tag === 'p'){
          var clone = child.cloneNode(true);
          clone.querySelectorAll('a').forEach(function(a){
            var span = document.createElement('span');
            span.innerHTML = a.innerHTML;
            a.replaceWith(span);
          });
          blocks.push('<p class="print-intro">' + clone.innerHTML + '</p>');
          return;
        }
        blocks.push(nodeHtmlWithoutLinks(child));
      });
      return '<section class="print-section print-intro-wrap">' + blocks.join('') + '</section>';
    }

    function sanitizeElementForPrint(node){
      var clone = node.cloneNode(true);
      clone.querySelectorAll('a').forEach(function(a){
        var span = document.createElement('span');
        span.innerHTML = a.innerHTML;
        a.replaceWith(span);
      });
      clone.querySelectorAll('img').forEach(function(img){
        img.setAttribute('src', absoluteUrl(img.getAttribute('src') || img.currentSrc || ''));
      });
      clone.querySelectorAll('figure').forEach(function(fig){
        fig.removeAttribute('style');
        fig.classList.remove('step-photo-left','step-photo-right','step-photo-large','print-figure-large','print-figure-small');
        if(fig.classList.contains('step-photo-large')) fig.classList.add('print-figure-large');
        else fig.classList.add('print-figure-small');
      });
      return clone;
    }

    function collectPreparationHtml(section){
      if(!section) return '';
      var list = section.querySelector('ol.steps') || section.querySelector('ol');
      if(!list) return collectSectionHtml(section, {cls:'print-body'});
      var steps = [];
      Array.from(list.children).forEach(function(li, idx){
        if(!li || li.tagName.toLowerCase() !== 'li') return;
        var clone = sanitizeElementForPrint(li);
        clone.style.listStyle = 'none';
        var bodyParts = [];
        Array.from(clone.childNodes).forEach(function(child){
          if(child.nodeType === 3){
            if((child.textContent || '').trim()){
              bodyParts.push('<p>' + escapeHtml(child.textContent.trim()) + '</p>');
            }
            return;
          }
          if(!child.tagName) return;
          var tag = child.tagName.toLowerCase();
          if(tag === 'p' || tag === 'div' || tag === 'figure' || tag === 'ul' || tag === 'ol' || tag === 'blockquote'){
            bodyParts.push(child.outerHTML);
          }else{
            bodyParts.push(nodeHtmlWithoutLinks(child));
          }
        });
        var textLength = (clone.textContent || '').replace(/\s+/g,' ').trim().length;
        var figureCount = clone.querySelectorAll('figure').length;
                steps.push('<section class="print-step"><div class="print-step-num">' + (idx + 1) + '.</div><div class="print-step-body">' + bodyParts.join('') + '</div></section>');
      });
      return '<section class="print-section print-body">' + steps.join('') + '</section>'; // steps kept indivisible in print
    }

    function collectIngredientsHtml(section){
      if(!section) return '';
      var table = section.querySelector('table.recipe-table');
      if(!table) return '';
      var items = [];
      table.querySelectorAll('tbody tr, tr').forEach(function(tr){
        var cells = tr.querySelectorAll('td');
        if(!cells.length) return;
        var ing = (cells[0] && cells[0].textContent || '').trim();
        var qty = (cells[1] && cells[1].textContent || '').trim();
        var unit = (cells[2] && cells[2].textContent || '').trim();
        var note = (cells[3] && cells[3].textContent || '').trim();
        if(!ing && !qty && !unit && !note) return;
        var pieces = [];
        if(ing) pieces.push(ing);
        var amount = [qty, unit].filter(Boolean).join(' ').trim();
        if(amount) pieces.push(amount);
        if(note) pieces.push(note);
        var item = pieces.join(' ').replace(/\s+/g, ' ').trim();
        if(item) items.push('<span class="print-ingredient-item">' + escapeHtml(item) + '</span>');
      });
      if(!items.length) return '';
      var ingredientNames = [];
      table.querySelectorAll('tbody tr, tr').forEach(function(tr){
        var cells = tr.querySelectorAll('td');
        if(!cells.length) return;
        var ingName = (cells[0] && cells[0].textContent || '').trim().toLowerCase();
        if(ingName) ingredientNames.push(ingName);
      });
      var ingredientAttr = escapeHtml(ingredientNames.join('|'));
      return '<section class="print-ingredients-block" data-ingredient-names="' + ingredientAttr + '"><div class="print-ingredients-title">Ingredienti</div><div class="print-ingredients-text">' + items.join('<span class="print-ingredient-sep"> · </span>') + '</div><aside class="print-ingredients-media" aria-hidden="true"></aside></section>';
    }

    function collectNotesHtml(section){
      if(!section) return '';
      var blocks = [];
      Array.from(section.children).forEach(function(child){
        if(!child || !child.tagName) return;
        var tag = child.tagName.toLowerCase();
        if(tag === 'h2' || tag === 'h3') return;
        if(tag === 'figure'){
          blocks.push(classifyFigure(child));
          return;
        }
        if(tag === 'p' || tag === 'div' || tag === 'blockquote'){
          var clone = child.cloneNode(true);
          clone.querySelectorAll('a').forEach(function(a){
            var span = document.createElement('span');
            span.innerHTML = a.innerHTML;
            a.replaceWith(span);
          });
          var raw = (clone.innerHTML || '').replace(/<br\s*\/?>(?=\s*)/gi, '\n');
          var tmp = document.createElement('div');
          tmp.innerHTML = raw;
          var text = (tmp.textContent || '').replace(/\r/g, '');
          text.split(/\n+/).forEach(function(line){
            line = line.trim();
            if(line) blocks.push('<p>' + escapeHtml(line) + '</p>');
          });
          return;
        }
        blocks.push(nodeHtmlWithoutLinks(child));
      });
      if(!blocks.length) return '';
      return '<section class="print-section print-notes">' + blocks.join('') + '</section>';
    }

    function buildPrintDocument(){
      var root = document.querySelector('main.recipe-page .recipe-content') || document.querySelector('.recipe-content');
      if(!root) return null;
      var title = root.querySelector('h1');
      var lead = root.querySelector('section.lead');
      var notes = root.querySelector('section.notes');
      var ingredientsSection = null;
      var prepSection = null;
      root.querySelectorAll('section.block').forEach(function(sec){
        var h2 = sec.querySelector(':scope > h2');
        var label = (h2 ? h2.textContent : '').trim().toLowerCase();
        if(!ingredientsSection && label === 'ingredienti') ingredientsSection = sec;
        else if(!prepSection && label === 'preparazione') prepSection = sec;
      });

      var ccLinkNode = document.querySelector('.cc-link');
      var ccImgNode = document.querySelector('.site-footer-left img');
      var qrImgNode = document.querySelector('.recipe-qrcode-link img, .site-footer-right img');
      var ccHref = absoluteUrl((ccLinkNode && ccLinkNode.getAttribute('href')) || 'https://creativecommons.org/licenses/by-nc-sa/4.0/');
      var ccImg = absoluteUrl((ccImgNode && (ccImgNode.getAttribute('src') || ccImgNode.currentSrc)) || '../../foto/licenze/Cc-by-nc-sa_icon.svg');
      var qrImg = qrImgNode ? absoluteUrl(qrImgNode.getAttribute('src') || qrImgNode.currentSrc || '') : '';

      var html = '';
      html += '<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">';
      html += '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
      html += '<title>' + escapeHtml(document.title) + '</title>';
      html += '<base href="' + escapeHtml(document.location.href) + '\">';
      html += '<style>' + [
        '@page{size:A4;margin:16mm 0 16mm 0;}',
        'html,body{margin:0;padding:0;background:#fff !important;color:#111;}',
        'body{font-family:Georgia,"Times New Roman",serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}',
        '.print-doc{position:relative;width:210mm;min-height:auto;margin:0 auto;background:#fff;padding:0;box-sizing:border-box;overflow:visible;}',
        '.print-page{position:relative;width:210mm;min-height:265mm;margin:0 auto;padding:0 22mm;box-sizing:border-box;break-after:page;page-break-after:always;} .print-page:last-child{break-after:auto;page-break-after:auto;}',
        '.print-page-content{position:relative;min-height:265mm;box-sizing:border-box;}',
        '.print-decor-layer,.print-page-decor-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:visible;} .print-decor-layer .print-decor-slot,.print-page-decor-layer .print-decor-slot{position:absolute;display:block;overflow:visible;pointer-events:none;user-select:none;z-index:0;} .print-decor-layer .print-decor-slot img,.print-page-decor-layer .print-decor-slot img{position:absolute;display:block;max-width:none;pointer-events:none;user-select:none;z-index:0;} .print-doc > *:not(.print-decor-layer){position:relative;z-index:1;}',
        '.print-title{font-family:Arial,Helvetica,sans-serif;font-size:24pt;line-height:1.06;font-weight:700;letter-spacing:.01em;color:#111;margin:0 0 8mm 0;}',
        '.print-section{font-family:Georgia,"Times New Roman",serif;font-size:11pt;line-height:1.45;width:100%;max-width:166mm;margin:0 auto;}',
        '.print-section p{margin:0 0 3.4mm 0;font-size:inherit;line-height:inherit;} .print-section > *{font-size:inherit;line-height:inherit;}',
        '.print-intro{font-size:11pt;line-height:1.45;font-style:italic;color:#333;margin:0 0 3.2mm 0;white-space:pre-line;}',
        '.print-intro-wrap p{margin:0 0 2.8mm 0;} .print-intro-wrap::after{content:"";display:block;clear:both;}',
        '.print-ingredients-block{position:relative;display:inline-block;width:auto;max-width:96mm;margin:0 0 6mm 0;padding:4.6mm 4mm 3.2mm 4mm;background:#fff;border:.25mm solid #d8d8d8;break-inside:avoid;page-break-inside:avoid;box-sizing:border-box;overflow:visible;text-align:left;}',
        '.print-ingredients-title{position:absolute;top:-2.8mm;left:3.2mm;background:#fff;padding:0 1.6mm;font-family:Arial,Helvetica,sans-serif;font-size:9.4pt;line-height:1.1;font-weight:500;color:#222;} .print-ingredients-text{position:relative;z-index:1;display:block;width:auto;max-width:88mm;min-width:0;font-family:Arial,Helvetica,sans-serif;font-size:9.2pt;line-height:1.4;text-align:left;color:#111;white-space:normal;}',
        '.print-ingredient-item{display:inline;font-weight:400;color:#111;}',
        '.print-ingredient-sep{display:inline;color:#666;}',
        '.print-ingredients-media{display:none;}',
        '.print-figure-large,.print-figure-small,.print-step figure,.print-step .image-row,.print-step .image-row > figure{break-inside:avoid !important;page-break-inside:avoid !important;}',
        '.print-figure-large{width:66% !important;max-width:66% !important;float:none !important;clear:both !important;margin:4mm auto 5mm !important;}',
        '.print-figure-small{width:33% !important;max-width:33% !important;float:right !important;clear:none !important;margin:1mm 0 3.5mm 5mm !important;}',
        '.print-figure-large img,.print-figure-small img{display:block;width:100% !important;max-width:100% !important;height:auto !important;box-shadow:none;background:#fff;}',
        '.print-figure-large figcaption,.print-figure-small figcaption{font-family:Arial,Helvetica,sans-serif;font-size:7.8pt;line-height:1.25;color:#555;margin-top:1.4mm;}',
        '.print-steps, ol.steps{padding-left:0;margin:0;}',
        '.print-step{position:relative;display:block;margin:0 0 4.2mm 0;padding:0 0 0 7.5mm;break-inside:avoid !important;page-break-inside:avoid !important;}',
        '.print-step-num{position:absolute;left:0;top:0;font-family:Arial,Helvetica,sans-serif;font-size:8.6pt;font-weight:500;color:#666;text-align:left;line-height:1.45;width:6mm;} .print-step-body{display:block;min-width:0;} .print-step-body::after{content:"";display:block;clear:both;} .print-step-body > *:first-child{margin-top:0;}',
        '.print-step-body > p,.print-step-body > div,.print-step-body > ul,.print-step-body > ol,.print-step-body > blockquote{break-inside:avoid !important;page-break-inside:avoid !important;}',
        '.print-step .image-row{display:flex !important;flex-wrap:wrap !important;gap:3mm !important;align-items:flex-start !important;justify-content:center !important;clear:both !important;width:100% !important;margin:1.5mm auto 4mm auto !important;}',
        '.print-step .image-row > figure{float:none !important;display:block !important;flex:0 0 39mm !important;max-width:39mm !important;width:39mm !important;margin:0 !important;clear:none !important;}',
        '.print-step .image-row > figure img{display:block;width:100% !important;max-width:100% !important;height:auto !important;}',
        '.print-step .image-row > figure figcaption{font-family:Arial,Helvetica,sans-serif;font-size:7.8pt;line-height:1.25;color:#555;margin-top:1.2mm;}',
        '.print-endmatter{width:100%;max-width:170mm;margin:6mm auto 0;break-inside:avoid;page-break-inside:avoid;}',
        '.print-notes-block{margin:0 0 3mm 0;padding:3.2mm 3.6mm;border:.25mm solid #d8d8d8;position:relative;break-inside:avoid;page-break-inside:avoid;}',
        '.print-notes-block::before{content:"!";position:absolute;top:2.6mm;left:3.2mm;width:4.8mm;height:4.8mm;border:.25mm solid #d0d0d0;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:9pt;line-height:4.5mm;text-align:center;color:#666;background:#fff;}',
        '.print-notes{font-size:11.1pt;line-height:1.54;color:#1f1f1f;white-space:normal;padding-left:8.4mm;}',
        '.print-notes p{margin:0 0 2.8mm 0;white-space:pre-line;}',
        '.print-section::after,.print-notes-block::after{content:"";display:block;clear:both;} .print-step-body > p{margin:0 0 3.4mm 0;} .print-step-body strong{font-weight:600;}',
        '.print-footer{margin-top:3.2mm;padding-top:4.2mm;border-top:.3mm solid #d7d7d7;display:grid;grid-template-columns:auto 1fr auto;align-items:center;column-gap:6mm;break-inside:avoid;page-break-inside:avoid;}',
        '.print-footer-left img{display:block;height:10mm;width:auto;} .print-footer-center{font-family:Arial,Helvetica,sans-serif;font-size:7.5pt;line-height:1.35;color:#555;text-align:center;align-self:center;} .print-footer-center a,.print-footer-center span{color:inherit;text-decoration:none;}',
        '.print-footer-right img{display:block;width:18mm;height:18mm;}',
        '.print-footer-spacer{min-height:0;}',
        '.print-doc strong{font-weight:600;} .print-doc em{font-style:italic;} a{color:inherit;text-decoration:none;}',
        '@media print{body{background:#fff !important;} .print-doc{margin:0;}}'
      ].join('') + '</style></head><body>';
      html += '<article class="print-doc">';
      html += '<h1 class="print-title">' + escapeHtml(title ? title.textContent.trim() : document.title) + '</h1>';
      html += collectIntroHtml(lead);
      html += collectIngredientsHtml(ingredientsSection);
      html += collectPreparationHtml(prepSection);
      var notesHtml = collectNotesHtml(notes);
      html += '<section class="print-endmatter">';
      if(notesHtml){ html += '<section class="print-notes-block">' + notesHtml + '</section>'; }
      html += '<footer class="print-footer">';
      html += '<div class="print-footer-left"><a href="' + escapeHtml(ccHref) + '"><img src="' + escapeHtml(ccImg) + '" alt="Licenza Creative Commons"></a></div>';
      html += '<div class="print-footer-center"><span>da: Ricette (e altro) di Pierre</span><br><span>' + escapeHtml(window.location.href) + '</span></div>';
      html += '<div class="print-footer-right">' + (qrImg ? '<img src="' + escapeHtml(qrImg) + '" alt="QR ricetta">' : '') + '</div>';
      html += '</footer></section></article></body></html>';
      return html;
    }

    function paginatePrintDocument(doc){
      if(!doc) return;
      var printDoc = doc.querySelector('.print-doc');
      if(!printDoc || printDoc.getAttribute('data-print-paginated') === '1') return;
      var pageHeightPx = mmToPx(doc, 265);
      if(!pageHeightPx || !isFinite(pageHeightPx)) return;
      var decorLayer = printDoc.querySelector('.print-decor-layer');
      if(decorLayer) decorLayer.remove();

      var originalChildren = Array.prototype.slice.call(printDoc.children).filter(function(node){
        return !(node && node.classList && node.classList.contains('print-decor-layer'));
      });

      function newPage(){
        var page = doc.createElement('section');
        page.className = 'print-page';
        var content = doc.createElement('div');
        content.className = 'print-page-content';
        page.appendChild(content);
        return {page:page, content:content};
      }

      function ensurePageContentBlocks(pageInfo){
        if(!pageInfo.content.querySelector('.print-steps')){
          var list = doc.createElement('ol');
          list.className = 'print-steps';
          pageInfo.content.appendChild(list);
        }
      }

      function ensurePagePrintBody(pageInfo, sourceBlock){
        var body = pageInfo && pageInfo.content ? pageInfo.content.querySelector('.print-body:last-of-type') || pageInfo.content.querySelector('.print-body') : null;
        if(body) return body;
        body = doc.createElement('section');
        body.className = sourceBlock && sourceBlock.className ? sourceBlock.className : 'print-section print-body';
        pageInfo.content.appendChild(body);
        return body;
      }

      function cleanupEmptyStepLists(pageInfo){
        if(!pageInfo || !pageInfo.content) return;
        Array.prototype.slice.call(pageInfo.content.querySelectorAll('.print-steps')).forEach(function(list){
          if(!list.querySelector('li')) list.remove();
        });
      }

      function cleanupEmptyPrintBodies(pageInfo){
        if(!pageInfo || !pageInfo.content) return;
        Array.prototype.slice.call(pageInfo.content.querySelectorAll('.print-body')).forEach(function(body){
          if(!body.querySelector('.print-step')) body.remove();
        });
      }

      function nodeHasMeaningfulContent(node){
        if(!node || !node.tagName) return false;
        if(node.classList && node.classList.contains('print-page-decor-layer')) return false;
        if(node.classList && node.classList.contains('print-steps')){
          return !!node.querySelector('li');
        }
        if(node.matches && node.matches('.print-footer, .print-notes-block, .print-ingredients-block, .print-lead, .print-section')){
          return true;
        }
        if(node.querySelector && node.querySelector('figure, img, .print-footer, .print-notes-block, .print-ingredients-block, .print-steps li')){
          return true;
        }
        var txt = (node.textContent || '').replace(/\s+/g,' ').trim();
        return txt.length > 0;
      }

      function pageHasContent(pageInfo){
        if(!(pageInfo && pageInfo.content)) return false;
        cleanupEmptyStepLists(pageInfo);
        cleanupEmptyPrintBodies(pageInfo);
        return Array.prototype.some.call(pageInfo.content.children, function(node){
          return nodeHasMeaningfulContent(node);
        });
      }

      function pruneEmptyPages(){
        pages.slice().forEach(function(pageInfo){
          cleanupEmptyStepLists(pageInfo);
          if(!pageHasContent(pageInfo) && pages.length > 1){
            var idx = pages.indexOf(pageInfo);
            if(idx >= 0) pages.splice(idx, 1);
            if(pageInfo.page && pageInfo.page.parentNode) pageInfo.page.parentNode.removeChild(pageInfo.page);
          }
        });
      }

      function contentHeight(pageInfo){
        return pageInfo && pageInfo.content ? pageInfo.content.getBoundingClientRect().height : 0;
      }

      printDoc.innerHTML = '';
      var pages = [];
      var current = newPage();
      printDoc.appendChild(current.page);
      pages.push(current);

      function appendBlockToCurrent(block){
        current.content.appendChild(block);
        if(contentHeight(current) > pageHeightPx + 0.5 && pageHasContent(current) && current.content.children.length > 1){
          block.remove();
          current = newPage();
          printDoc.appendChild(current.page);
          pages.push(current);
          current.content.appendChild(block);
        }
      }

      originalChildren.forEach(function(child){
        if(!child || !child.tagName) return;
        if(child.classList && child.classList.contains('print-steps')){
          var items = Array.prototype.slice.call(child.children).filter(function(li){
            return li && li.tagName && li.tagName.toLowerCase() === 'li';
          });
          items.forEach(function(li){
            ensurePageContentBlocks(current);
            var currentList = current.content.querySelector('.print-steps:last-of-type') || current.content.querySelector('.print-steps');
            currentList.appendChild(li);
            if(contentHeight(current) > pageHeightPx + 0.5 && pageHasContent(current) && currentList.children.length > 1){
              li.remove();
              cleanupEmptyStepLists(current);
              current = newPage();
              printDoc.appendChild(current.page);
              pages.push(current);
              ensurePageContentBlocks(current);
              current.content.querySelector('.print-steps').appendChild(li);
            }
          });
          return;
        }
        if(child.classList && child.classList.contains('print-body')){
          var steps = Array.prototype.slice.call(child.children).filter(function(step){
            return step && step.classList && step.classList.contains('print-step');
          });
          if(steps.length){
            steps.forEach(function(step){
              var currentBody = ensurePagePrintBody(current, child);
              currentBody.appendChild(step);
              if(contentHeight(current) > pageHeightPx + 0.5 && pageHasContent(current) && currentBody.children.length > 1){
                step.remove();
                cleanupEmptyPrintBodies(current);
                current = newPage();
                printDoc.appendChild(current.page);
                pages.push(current);
                currentBody = ensurePagePrintBody(current, child);
                currentBody.appendChild(step);
              }
            });
            return;
          }
        }
        appendBlockToCurrent(child);
      });

      pruneEmptyPages();

      var freshLayer = doc.createElement('div');
      freshLayer.className = 'print-decor-layer';
      printDoc.insertBefore(freshLayer, printDoc.firstChild);
      printDoc.setAttribute('data-print-paginated', '1');
    }

    function ensureDecorLayer(doc){
      var printDoc = doc.querySelector('.print-doc');
      if(!printDoc) return null;
      var layer = printDoc.querySelector('.print-decor-layer');
      if(layer) return layer;
      layer = doc.createElement('div');
      layer.className = 'print-decor-layer';
      printDoc.insertBefore(layer, printDoc.firstChild);
      return layer;
    }

    function mmToPx(doc, mm){
      var probe = doc.createElement('div');
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.width = '100mm';
      probe.style.height = '0';
      doc.body.appendChild(probe);
      var px = probe.getBoundingClientRect().width / 100 * mm;
      probe.remove();
      return px;
    }

function injectPrintIngredientDecor(doc){
  if(!doc){
    return Promise.resolve({status:'no-doc'});
  }
  paginatePrintDocument(doc);
  Array.prototype.slice.call(doc.querySelectorAll('.print-page')).forEach(function(page){
    page.style.height = '265mm';
    page.style.minHeight = '265mm';
    page.style.overflow = 'hidden';
  });
  var printDoc = doc.querySelector('.print-doc');
  if(!printDoc){
    return Promise.resolve({status:'no-print-doc'});
  }
  var layer = ensureDecorLayer(doc);
  if(!layer){
    return Promise.resolve({status:'no-layer'});
  }
  layer.innerHTML = '';
  var rasterScale = 0.60;
  var whiteThreshold = 235;
  var ingredientAssetRelpaths = Array.isArray(window.__PRINT_INGREDIENT_ASSET_RELPATHS__) ? window.__PRINT_INGREDIENT_ASSET_RELPATHS__.slice() : [];
  var ingredientBaseHref = '/ingredienti/';

  function resolveIngredientAssetUrl(relpath){
    if(!relpath) return '';
    try{ return new URL(ingredientBaseHref + String(relpath).replace(/^\/+/, ''), window.location.origin || window.location.href).href; }catch(e){ return ''; }
  }

  function shuffleInPlace(arr){
    for(var i = arr.length - 1; i > 0; i -= 1){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function buildEligibleIngredientAssets(){
    var pool = ingredientAssetRelpaths.filter(function(relpath){
      if(!relpath) return false;
      if(!/\.jpe?g$/i.test(String(relpath))) return false;
      return !!resolveIngredientAssetUrl(relpath);
    }).slice();
    shuffleInPlace(pool);
    return {pool:pool, cursor:0, recent:[]};
  }

  function pickNextAsset(state, usedMap){
    if(!state || !Array.isArray(state.pool) || !state.pool.length) return '';
    var pool = state.pool;
    var len = pool.length;
    var recent = Array.isArray(state.recent) ? state.recent : [];
    for(var pass = 0; pass < 3; pass += 1){
      for(var step = 0; step < len; step += 1){
        var idx = (state.cursor + step) % len;
        var pick = pool[idx];
        if(!pick) continue;
        var recentlyUsed = recent.indexOf(pick) !== -1;
        if(pass === 0 && (usedMap[pick] || recentlyUsed)) continue;
        if(pass === 1 && recentlyUsed) continue;
        state.cursor = (idx + 1) % len;
        usedMap[pick] = (usedMap[pick] || 0) + 1;
        recent.push(pick);
        while(recent.length > Math.min(12, Math.max(4, Math.floor(len / 8)))) recent.shift();
        state.recent = recent;
        return pick;
      }
    }
    return '';
  }

  function rectsIntersect(a, b){
    return !!(a && b && !(a.left >= b.right || a.right <= b.left || a.top >= b.bottom || a.bottom <= b.top));
  }

  function buildPhysicalPageInfos(){
    var pages = Array.prototype.slice.call(doc.querySelectorAll('.print-page'));
    var printRect = printDoc.getBoundingClientRect();
    var nominalPageHeight = mmToPx(doc, 265);
    var infos = [];
    var physicalIndex = 0;
    pages.forEach(function(page, domPageIndex){
      var contentNode = page.querySelector('.print-page-content') || page;
      var rects = Array.prototype.slice.call(contentNode.getClientRects ? contentNode.getClientRects() : []).filter(function(r){
        return r && r.height > 2 && r.width > 2;
      });
      if(!rects.length){
        var pageRect = page.getBoundingClientRect();
        rects = [pageRect];
      }
      rects.forEach(function(rect, part){
        var topPx = Math.max(0, rect.top - printRect.top);
        var bottomPx = Math.max(topPx + 1, rect.bottom - printRect.top);
        infos.push({
          physicalIndex: physicalIndex++,
          domPageIndex: domPageIndex,
          page: page,
          partIndex: part,
          pageTop: topPx,
          topPx: topPx,
          bottomPx: bottomPx,
          nominalPageHeight: nominalPageHeight,
          printRect: printRect,
          fragmentRect: rect
        });
      });
    });
    return infos;
  }

  function collectPageImageExclusions(pageInfo){
    if(!pageInfo || !pageInfo.page) return [];
    var printRect = pageInfo.printRect || printDoc.getBoundingClientRect();
    var pad = mmToPx(doc, 5);
    var sliceTop = pageInfo.topPx;
    var sliceBottom = pageInfo.bottomPx;
    return Array.prototype.slice.call(pageInfo.page.querySelectorAll('figure, .print-footer-right img')).map(function(node){
      var r = node.getBoundingClientRect();
      var top = Math.max(0, r.top - printRect.top - pad);
      var bottom = r.bottom - printRect.top + pad;
      if(bottom <= sliceTop || top >= sliceBottom) return null;
      return {
        left: Math.max(0, r.left - printRect.left - pad),
        top: top,
        right: r.right - printRect.left + pad,
        bottom: bottom
      };
    }).filter(function(r){ return r && r.right > r.left && r.bottom > r.top; });
  }

  function collectPageBlockExclusions(pageInfo){
    if(!pageInfo || !pageInfo.page) return [];
    var printRect = pageInfo.printRect || printDoc.getBoundingClientRect();
    var blockPad = mmToPx(doc, 3);
    var ingredientPad = mmToPx(doc, 2);
    var sliceTop = pageInfo.topPx;
    var sliceBottom = pageInfo.bottomPx;
    return Array.prototype.slice.call(pageInfo.page.querySelectorAll('.print-ingredients-block, .print-notes-block, .print-footer')).map(function(node){
      var r = node.getBoundingClientRect();
      var isIngredient = !!(node && node.classList && node.classList.contains('print-ingredients-block'));
      var padX = isIngredient ? ingredientPad : 0;
      var padY = isIngredient ? ingredientPad : blockPad;
      var top = Math.max(0, r.top - printRect.top - padY);
      var bottom = r.bottom - printRect.top + padY;
      if(bottom <= sliceTop || top >= sliceBottom) return null;
      return {
        left: Math.max(0, r.left - printRect.left - padX),
        top: top,
        right: r.right - printRect.left + padX,
        bottom: bottom
      };
    }).filter(function(r){ return r && r.right > r.left && r.bottom > r.top; });
  }

  function getPageSafeBounds(pageInfo){
    if(!pageInfo || !pageInfo.page) return null;
    var printRect = pageInfo.printRect || printDoc.getBoundingClientRect();
    var pageRect = pageInfo.page.getBoundingClientRect();
    var nominalPageHeight = pageInfo.nominalPageHeight || mmToPx(doc, 265);
    var sideInset = mmToPx(doc, 5);
    var topInset = mmToPx(doc, 4);
    var bottomInset = mmToPx(doc, 10);
    var pageTop = pageInfo.topPx;
    var pageBottom = pageTop + nominalPageHeight;
    var safe = {
      left: pageRect.left - printRect.left + sideInset,
      top: pageTop + topInset,
      right: pageRect.right - printRect.left - sideInset,
      bottom: pageBottom - bottomInset
    };
    if(safe.right <= safe.left || safe.bottom <= safe.top) return null;
    safe.width = safe.right - safe.left;
    safe.height = safe.bottom - safe.top;
    return safe;
  }

  function getPageSliceBounds(pageInfo, snapshotScale){
    if(!pageInfo || !snapshotScale) return null;
    var topPx = Math.max(0, pageInfo.topPx);
    var bottomPx = Math.max(topPx + 1, pageInfo.bottomPx);
    var topScaled = Math.max(0, Math.floor(topPx * snapshotScale));
    var bottomScaled = Math.max(topScaled + 1, Math.ceil(bottomPx * snapshotScale));
    return {
      topPx: topPx,
      bottomPx: bottomPx,
      topScaled: topScaled,
      bottomScaled: bottomScaled,
      domPageIndex: pageInfo.domPageIndex,
      physicalIndex: pageInfo.physicalIndex
    };
  }
  function getPageDecorLayer(pageIndex){
    var pages = Array.prototype.slice.call(doc.querySelectorAll('.print-page'));
    var domIndex = (pageIndex && typeof pageIndex === 'object' && typeof pageIndex.domPageIndex === 'number') ? pageIndex.domPageIndex : pageIndex;
    var page = pages[domIndex];
    if(!page) return null;
    var layerSel = '.print-page-decor-layer';
    var pageLayer = page.querySelector(layerSel);
    if(!pageLayer){
      pageLayer = doc.createElement('div');
      pageLayer.className = 'print-page-decor-layer';
      pageLayer.setAttribute('aria-hidden', 'true');
      page.insertBefore(pageLayer, page.firstChild || null);
    }
    pageLayer.style.position = 'absolute';
    pageLayer.style.left = '0';
    pageLayer.style.top = '0';
    pageLayer.style.right = '0';
    pageLayer.style.bottom = '0';
    pageLayer.style.pointerEvents = 'none';
    pageLayer.style.overflow = 'hidden';
    pageLayer.style.zIndex = '0';
    return pageLayer;
  }

  function getPageOrigin(pageIndex){
    var pages = Array.prototype.slice.call(doc.querySelectorAll('.print-page'));
    var domIndex = (pageIndex && typeof pageIndex === 'object' && typeof pageIndex.domPageIndex === 'number') ? pageIndex.domPageIndex : pageIndex;
    var page = pages[domIndex];
    if(!page) return null;
    var printRect = printDoc.getBoundingClientRect();
    var pageRect = page.getBoundingClientRect();
    var nominalPageHeight = mmToPx(doc, 265);
    return {
      left: pageRect.left - printRect.left,
      top: pageRect.top - printRect.top,
      width: pageRect.width,
      height: nominalPageHeight
    };
  }
  function computeDecorPlacement(rectPx, pageIndex, placedDecorBounds, safe){
    safe = safe || getPageSafeBounds(pageIndex);
    if(!safe) return null;
    var pageOrigin = getPageOrigin(pageIndex);
    if(!pageOrigin) return null;
    var expand = 1.30;
    var targetW = rectPx.w * expand;
    var targetH = rectPx.h * expand;
    var cx = rectPx.x + rectPx.w / 2;
    var cy = rectPx.y + rectPx.h / 2;

    var safeW = safe.right - safe.left;
    var safeH = safe.bottom - safe.top;
    if(targetW > safeW || targetH > safeH){
      var shrink = Math.min(safeW / targetW, safeH / targetH, 1);
      if(!isFinite(shrink) || shrink <= 0) return null;
      targetW *= shrink;
      targetH *= shrink;
    }

    var slotLeft = Math.max(safe.left, Math.min(cx - targetW / 2, safe.right - targetW));
    var slotTop = Math.max(safe.top, Math.min(cy - targetH / 2, safe.bottom - targetH));
    var slotRight = slotLeft + targetW;
    var slotBottom = slotTop + targetH;

    var slotW = slotRight - slotLeft;
    var slotH = slotBottom - slotTop;
    if(slotW < 20 || slotH < 20) return null;

    var minVisibleArea = rectPx.w * rectPx.h * 0.34;
    var minVisibleW = Math.max(mmToPx(doc, 26), rectPx.w * 0.42);
    var minVisibleH = Math.max(mmToPx(doc, 16), rectPx.h * 0.42);
    if((slotW * slotH) < minVisibleArea) return null;
    if(slotW < minVisibleW || slotH < minVisibleH) return null;

    var visible = {left:slotLeft, top:slotTop, right:slotRight, bottom:slotBottom};
    for(var j = 0; j < placedDecorBounds.length; j += 1){
      if(rectsIntersect(visible, placedDecorBounds[j])) return null;
    }
    return {
      slotLeft: slotLeft,
      slotTop: slotTop,
      slotWidth: slotW,
      slotHeight: slotH,
      imgLeft: 0,
      imgTop: 0,
      imgWidth: slotW,
      imgHeight: slotH,
      bounds: visible,
      pageOrigin: pageOrigin
    };
  }

  function addDecorImage(placement, assetUrl, pageIndex){
    if(!assetUrl || !placement) return Promise.resolve(false);
    return new Promise(function(resolve){
      var ProbeImage = (doc.defaultView && doc.defaultView.Image) ? doc.defaultView.Image : Image;
      var probe = new ProbeImage();
      var settled = false;
      function finish(ok){
        if(settled) return;
        settled = true;
        resolve(!!ok);
      }
      probe.onload = function(){
        var naturalW = Math.max(1, probe.naturalWidth || probe.width || 1);
        var naturalH = Math.max(1, probe.naturalHeight || probe.height || 1);
        var slotW = Math.max(1, placement.slotWidth || 1);
        var slotH = Math.max(1, placement.slotHeight || 1);
        var scale = Math.min(slotW / naturalW, slotH / naturalH, 1);
        if(!isFinite(scale) || scale <= 0) scale = 1;
        var renderW = Math.max(1, Math.round(naturalW * scale));
        var renderH = Math.max(1, Math.round(naturalH * scale));
        var offsetX = Math.round((slotW - renderW) / 2);
        var offsetY = Math.round((slotH - renderH) / 2);
        var pageLayer = getPageDecorLayer(pageIndex);
        var pageOrigin = placement.pageOrigin || getPageOrigin(pageIndex);
        if(!pageLayer || !pageOrigin){ finish(false); return; }

        var slot = doc.createElement('div');
        slot.className = 'print-decor-slot';
        slot.setAttribute('aria-hidden', 'true');
        slot.style.position = 'absolute';
        slot.style.left = Math.round(placement.slotLeft - pageOrigin.left) + 'px';
        slot.style.top = Math.round(placement.slotTop - pageOrigin.top) + 'px';
        slot.style.width = Math.max(1, Math.round(slotW)) + 'px';
        slot.style.height = Math.max(1, Math.round(slotH)) + 'px';
        slot.style.opacity = '0.20';
        slot.style.boxSizing = 'border-box';
        slot.style.overflow = 'hidden';

        var img = doc.createElement('img');
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        img.src = assetUrl;
        img.style.position = 'absolute';
        img.style.left = offsetX + 'px';
        img.style.top = offsetY + 'px';
        img.style.width = renderW + 'px';
        img.style.height = renderH + 'px';
        img.style.objectFit = 'contain';
        img.style.objectPosition = 'center center';
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';

        slot.appendChild(img);
        pageLayer.appendChild(slot);
        finish(true);
      };
      probe.onerror = function(){ finish(false); };
      probe.src = assetUrl;
      if(probe.complete && probe.naturalWidth > 0){
        probe.onload();
      }
      setTimeout(function(){ finish(false); }, 2500);
    });
  }

  function buildFreeMaskDataUrl(snapshotCanvas, pageTopScaled, pageBottomScaled, threshold){
    var sliceHeight = Math.max(1, pageBottomScaled - pageTopScaled);
    var maskCanvas = doc.createElement('canvas');
    maskCanvas.width = snapshotCanvas.width;
    maskCanvas.height = sliceHeight;
    var maskCtx = maskCanvas.getContext('2d', {willReadFrequently:true});
    if(!maskCtx) throw new Error('mask canvas context unavailable');
    var srcCtx = snapshotCanvas.getContext('2d', {willReadFrequently:true});
    if(!srcCtx) throw new Error('snapshot canvas context unavailable');
    var src = srcCtx.getImageData(0, pageTopScaled, snapshotCanvas.width, sliceHeight);
    var out = maskCtx.createImageData(snapshotCanvas.width, sliceHeight);
    var srcData = src.data;
    var outData = out.data;
    var freeCount = 0;
    var occupiedCount = 0;
    for(var i = 0; i < srcData.length; i += 4){
      var a = srcData[i + 3];
      var isFree = true;
      if(a >= 8){
        var r = srcData[i];
        var g = srcData[i + 1];
        var b = srcData[i + 2];
        isFree = (((r + g + b) / 3) > threshold);
      }
      if(isFree){
        outData[i] = 0;
        outData[i + 1] = 190;
        outData[i + 2] = 0;
        outData[i + 3] = 96;
        freeCount += 1;
      }else{
        outData[i] = 0;
        outData[i + 1] = 0;
        outData[i + 2] = 0;
        outData[i + 3] = 0;
        occupiedCount += 1;
      }
    }
    maskCtx.putImageData(out, 0, 0);
    return {
      dataUrl: maskCanvas.toDataURL('image/png'),
      freePixels: freeCount,
      occupiedPixels: occupiedCount,
      totalPixels: Math.max(1, freeCount + occupiedCount)
    };
  }

  function waitForImages(root){
    var images = Array.prototype.slice.call((root && root.querySelectorAll) ? root.querySelectorAll('img') : []);
    return Promise.all(images.map(function(img){
      return new Promise(function(resolve){
        var done = false;
        function finish(){ if(done) return; done = true; resolve(); }
        try{
          var src = img.currentSrc || img.getAttribute('src') || '';
          if(!src){ finish(); return; }
          if(img.complete && img.naturalWidth > 0){ finish(); return; }
          img.addEventListener('load', finish, {once:true});
          img.addEventListener('error', finish, {once:true});
          setTimeout(finish, 2500);
        }catch(_e){ finish(); }
      });
    }));
  }

  function waitForFonts(doc){
    try{
      if(doc && doc.fonts && doc.fonts.ready) return doc.fonts.ready.catch(function(){ return null; });
    }catch(e){}
    return Promise.resolve();
  }

  function loadHtml2Canvas(doc){
    var w = doc && doc.defaultView ? doc.defaultView : window;
    if(w.html2canvas) return Promise.resolve(w.html2canvas);
    return new Promise(function(resolve, reject){
      var existing = doc.getElementById('html2canvas-loader');
      function done(){
        if(w.html2canvas) resolve(w.html2canvas);
        else reject(new Error('html2canvas unavailable'));
      }
      if(existing){
        existing.addEventListener('load', done, {once:true});
        existing.addEventListener('error', function(){ reject(new Error('html2canvas script load failed')); }, {once:true});
        return;
      }
      var script = doc.createElement('script');
      script.id = 'html2canvas-loader';
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.onload = done;
      script.onerror = function(){
        var fallback = doc.createElement('script');
        fallback.src = 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js';
        fallback.onload = done;
        fallback.onerror = function(){ reject(new Error('html2canvas script load failed')); };
        doc.head.appendChild(fallback);
      };
      doc.head.appendChild(script);
    });
  }

  function rasterizePrintDoc(){
    return Promise.resolve()
      .then(function(){ return waitForImages(doc); })
      .then(function(){ return waitForFonts(doc); })
      .then(function(){ return loadHtml2Canvas(doc); })
      .then(function(html2canvas){
        try{
          if(layer) layer.style.display = 'none';
        }catch(_e){}
        return html2canvas(printDoc, {
          backgroundColor: '#ffffff',
          scale: rasterScale,
          useCORS: true,
          allowTaint: true,
          logging: false,
          imageTimeout: 0,
          removeContainer: true,
          foreignObjectRendering: false,
          ignoreElements: function(el){
            try{
              return !!(el && el.classList && (
                el.classList.contains('print-decor-layer') ||
                el.classList.contains('print-debug-mask-raster') ||
                el.classList.contains('print-decor-slot')
              ));
            }catch(_e){ return false; }
          }
        }).then(function(canvas){
          try{
            if(layer) layer.style.display = '';
          }catch(_e){}
          return {snapshotCanvas:canvas, width:canvas.width, height:canvas.height, scale:rasterScale};
        }).catch(function(err){
          try{
            if(layer) layer.style.display = '';
          }catch(_e){}
          throw err;
        });
      });
  }

  function buildFreeBinary(snapshotCanvas, pageTopScaled, pageBottomScaled, threshold){
    var sliceHeight = Math.max(1, pageBottomScaled - pageTopScaled);
    var srcCtx = snapshotCanvas.getContext('2d', {willReadFrequently:true});
    if(!srcCtx) throw new Error('snapshot canvas context unavailable');
    var src = srcCtx.getImageData(0, pageTopScaled, snapshotCanvas.width, sliceHeight);
    var data = src.data;
    var width = snapshotCanvas.width;
    var height = sliceHeight;
    var binary = new Uint8Array(width * height);
    var occupied = new Uint8Array(width * height);
    var alphaCut = 8;
    var localThreshold = Math.max(224, Math.min(241, threshold - 2));
    var edgeThreshold = 14;
    var occupiedCount = 0;
    for(var y = 0; y < height; y += 1){
      for(var x = 0; x < width; x += 1){
        var pos = y * width + x;
        var idx = pos * 4;
        var a = data[idx + 3];
        if(a < alphaCut){
          binary[pos] = 1;
          continue;
        }
        var r = data[idx];
        var g = data[idx + 1];
        var b = data[idx + 2];
        var avg = (r + g + b) / 3;
        var maxc = Math.max(r, g, b);
        var minc = Math.min(r, g, b);
        var chroma = maxc - minc;
        var isBright = avg >= localThreshold;
        var isNearWhite = isBright && (255 - minc) <= 30 && chroma <= 22;
        if(!isNearWhite){
          occupied[pos] = 1;
          binary[pos] = 0;
          occupiedCount += 1;
        }else{
          binary[pos] = 1;
        }
      }
    }
    var dilated = occupied.slice();
    for(var y2 = 1; y2 < height - 1; y2 += 1){
      for(var x2 = 1; x2 < width - 1; x2 += 1){
        var pos2 = y2 * width + x2;
        if(!occupied[pos2]) continue;
        dilated[pos2 - 1] = 1;
        dilated[pos2 + 1] = 1;
        dilated[pos2 - width] = 1;
        dilated[pos2 + width] = 1;
      }
    }
    for(var y3 = 1; y3 < height - 1; y3 += 1){
      for(var x3 = 1; x3 < width - 1; x3 += 1){
        var pos3 = y3 * width + x3;
        if(dilated[pos3]){
          binary[pos3] = 0;
          continue;
        }
        var idx3 = pos3 * 4;
        var avg3 = (data[idx3] + data[idx3 + 1] + data[idx3 + 2]) / 3;
        if(avg3 < localThreshold + 6){
          var leftIdx = idx3 - 4;
          var rightIdx = idx3 + 4;
          var upIdx = idx3 - width * 4;
          var downIdx = idx3 + width * 4;
          var gx = Math.abs(((data[leftIdx] + data[leftIdx + 1] + data[leftIdx + 2]) / 3) - ((data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3));
          var gy = Math.abs(((data[upIdx] + data[upIdx + 1] + data[upIdx + 2]) / 3) - ((data[downIdx] + data[downIdx + 1] + data[downIdx + 2]) / 3));
          if(gx >= edgeThreshold || gy >= edgeThreshold){
            binary[pos3] = 0;
          }
        }
      }
    }
    for(var y4 = 1; y4 < height - 1; y4 += 1){
      for(var x4 = 1; x4 < width - 1; x4 += 1){
        var pos4 = y4 * width + x4;
        if(binary[pos4]) continue;
        var whiteNeighbors = 0;
        for(var dy = -1; dy <= 1; dy += 1){
          for(var dx = -1; dx <= 1; dx += 1){
            if(dx === 0 && dy === 0) continue;
            if(binary[(y4 + dy) * width + (x4 + dx)]) whiteNeighbors += 1;
          }
        }
        if(whiteNeighbors >= 7) binary[pos4] = 1;
      }
    }
    var freeCount = 0;
    for(var i = 0; i < binary.length; i += 1){ if(binary[i]) freeCount += 1; }
    return {width:width, height:height, data:binary, freePixels:freeCount, occupiedPixels:Math.max(0, binary.length - freeCount)};
  }

  function buildIntegral(binary){
    var width = binary.width;
    var height = binary.height;
    var src = binary.data;
    var integ = new Uint32Array((width + 1) * (height + 1));
    for(var y = 1; y <= height; y += 1){
      var rowSum = 0;
      for(var x = 1; x <= width; x += 1){
        rowSum += src[(y - 1) * width + (x - 1)];
        integ[y * (width + 1) + x] = integ[(y - 1) * (width + 1) + x] + rowSum;
      }
    }
    return {width:width, height:height, data:integ};
  }

  function rectSum(integral, x, y, w, h){
    var stride = integral.width + 1;
    var x2 = x + w;
    var y2 = y + h;
    var d = integral.data;
    return d[y2 * stride + x2] - d[y * stride + x2] - d[y2 * stride + x] + d[y * stride + x];
  }

  function intersectsAny(rect, placed){
    for(var i = 0; i < placed.length; i += 1){
      var p = placed[i];
      if(!(rect.x + rect.w <= p.x || p.x + p.w <= rect.x || rect.y + rect.h <= p.y || p.y + p.h <= rect.y)) return true;
    }
    return false;
  }

  function findRectanglesForPage(snapshotCanvas, pageTopScaled, pageBottomScaled, threshold, minRectW, minRectH, pageInfo, scaleBack){
    var binary = buildFreeBinary(snapshotCanvas, pageTopScaled, pageBottomScaled, threshold);
    var integral = buildIntegral(binary);
    var width = binary.width;
    var height = binary.height;
    var placedBase = [];
    var placedDecorBounds = [];
    var accepted = [];
    var candidateRects = [];
    var maxRects = 3;
    var maxCandidates = Number.POSITIVE_INFINITY;
    var safe = getPageSafeBounds(pageInfo);
    var imageExclusionsPx = collectPageImageExclusions(pageInfo);
    var blockExclusionsPx = collectPageBlockExclusions(pageInfo);
    if(!safe) return {selected:accepted, candidates:candidateRects, safe:safe, binary:binary};
    var x0 = Math.max(0, Math.floor(safe.left / scaleBack));
    var x1 = Math.min(width, Math.ceil(safe.right / scaleBack));
    var y0 = Math.max(0, Math.floor((safe.top - pageTopScaled * scaleBack) / scaleBack));
    var y1 = Math.min(height, Math.ceil((safe.bottom - pageTopScaled * scaleBack) / scaleBack));
    var regionW = x1 - x0;
    var regionH = y1 - y0;
    var freePctPage = binary && binary.data && binary.data.length ? (binary.freePixels / binary.data.length) * 100 : 0;
    var isVeryFreePage = freePctPage > 85;
    if(regionW < minRectW || regionH < minRectH) return {selected:accepted, candidates:candidateRects, safe:safe, binary:binary};

    function overlapRatio(a, b){
      var ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      var iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      var inter = ix * iy;
      if(!inter) return 0;
      return inter / Math.min(a.w * a.h, b.w * b.h);
    }

    function expandRect(rect, factor){
      factor = factor || 1;
      var extraW = rect.w * (factor - 1);
      var extraH = rect.h * (factor - 1);
      return {
        x: rect.x - extraW / 2,
        y: rect.y - extraH / 2,
        w: rect.w + extraW,
        h: rect.h + extraH
      };
    }

    function rectsOverlap(a, b){
      return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
    }

    function intersectsScaledExclusions(rect, exclusionsPx){
      if(!exclusionsPx || !exclusionsPx.length) return false;
      for(var ei = 0; ei < exclusionsPx.length; ei += 1){
        var ex = exclusionsPx[ei];
        var sx = ex.left / scaleBack;
        var sy = (ex.top - pageTopScaled * scaleBack) / scaleBack;
        var sw = (ex.right - ex.left) / scaleBack;
        var sh = (ex.bottom - ex.top) / scaleBack;
        if(sw <= 0 || sh <= 0) continue;
        if(!(rect.x + rect.w <= sx || sx + sw <= rect.x || rect.y + rect.h <= sy || sy + sh <= rect.y)) return true;
      }
      return false;
    }

    function pushCandidate(rect){
      for(var i = 0; i < candidateRects.length; i += 1){
        var existing = candidateRects[i];
        if(overlapRatio(existing, rect) >= 0.70){
          if(rect.score > existing.score || (rect.score === existing.score && rect.area > existing.area)){
            candidateRects[i] = rect;
          }
          return;
        }
      }
      candidateRects.push(rect);
    }

    function editorialScore(rect){
      return rect.area * rect.freeRatio;
    }

    function scanPass(widthStart, widthEnd, widthStep, ratioThreshold, scanStep, preferMedium){
      for(var w = widthStart; w >= widthEnd; w -= widthStep){
        var h = Math.round(w * 3 / 4);
        if(h < minRectH || h > regionH) continue;
        for(var y = y0; y <= y1 - h; y += scanStep){
          for(var x = x0; x <= x1 - w; x += scanStep){
            var area = w * h;
            var freeSum = rectSum(integral, x, y, w, h);
            var freeRatio = freeSum / area;
            if(freeRatio < ratioThreshold) continue;
            var rect = {x:x, y:y, w:w, h:h, area:area, freeRatio:freeRatio, safe:safe};
            if(intersectsScaledExclusions(rect, imageExclusionsPx)) continue;
            if(intersectsScaledExclusions(rect, blockExclusionsPx)) continue;
            rect.score = editorialScore(rect) + (preferMedium ? area * 0.04 : 0);
            pushCandidate(rect);
          }
        }
      }
    }

    var maxWidth43 = Math.min(regionW, Math.floor(regionH * 4 / 3));
    var largeStep = Math.max(6, Math.round(maxWidth43 / 24));
    var largeScan = Math.max(3, Math.round(minRectW / 18));
    var mediumStart = Math.min(maxWidth43, Math.max(minRectW, Math.round(maxWidth43 * 0.76)));
    var mediumEnd = Math.max(minRectW, Math.round(maxWidth43 * 0.42));
    var mediumStep = Math.max(4, Math.round(minRectW / 10));
    var mediumScan = Math.max(2, Math.round(minRectW / 26));
    var smallStart = Math.max(minRectW, Math.round(maxWidth43 * 0.48));
    var smallEnd = minRectW;
    var smallStep = Math.max(2, Math.round(minRectW / 14));
    var smallScan = Math.max(1, Math.round(minRectW / 40));

    scanPass(maxWidth43, Math.max(minRectW, Math.round(maxWidth43 * 0.70)), largeStep, 0.992, largeScan, false);
    if(candidateRects.length < 22){
      scanPass(mediumStart, mediumEnd, mediumStep, 0.985, mediumScan, true);
    }
    if(candidateRects.length < 16){
      scanPass(smallStart, smallEnd, smallStep, 0.972, smallScan, true);
    }

    candidateRects.sort(function(a, b){
      if(b.score !== a.score) return b.score - a.score;
      if(b.area !== a.area) return b.area - a.area;
      if(b.freeRatio !== a.freeRatio) return b.freeRatio - a.freeRatio;
      return a.y - b.y;
    });

    for(var j = 0; j < candidateRects.length && accepted.length < maxRects; j += 1){
      var candidate = candidateRects[j];
      var overlapBlocked = false;
      var expandedCandidate = expandRect(candidate, 1.30);
      for(var k = 0; k < placedBase.length; k += 1){
        var expandedPlaced = expandRect(placedBase[k], 1.30);
        if(rectsOverlap(expandedCandidate, expandedPlaced)){
          overlapBlocked = true;
          break;
        }
      }
      if(overlapBlocked) continue;
      var rectPx = {
        x: candidate.x * scaleBack,
        y: (pageTopScaled + candidate.y) * scaleBack,
        w: candidate.w * scaleBack,
        h: candidate.h * scaleBack
      };
      var placement = computeDecorPlacement(rectPx, pageInfo, placedDecorBounds, candidate.safe);
      if(!placement) continue;
      placedBase.push(candidate);
      placedDecorBounds.push(placement.bounds);
      accepted.push({rect:candidate, placement:placement, score:candidate.score});
    }
    accepted.sort(function(a, b){ return (b.rect.area - a.rect.area) || (b.score - a.score); });
    return {selected:accepted.slice(0, maxRects), candidates:candidateRects, safe:safe, binary:binary};
  }

  function buildPageDebugDataUrl(snapshotCanvas, pageTopScaled, pageBottomScaled, threshold, debugInfo, scaleBack){
    var sliceHeight = Math.max(1, pageBottomScaled - pageTopScaled);
    var dbgCanvas = doc.createElement('canvas');
    dbgCanvas.width = snapshotCanvas.width;
    dbgCanvas.height = sliceHeight;
    var dbgCtx = dbgCanvas.getContext('2d', {willReadFrequently:true});
    if(!dbgCtx) return '';
    dbgCtx.drawImage(snapshotCanvas, 0, pageTopScaled, snapshotCanvas.width, sliceHeight, 0, 0, snapshotCanvas.width, sliceHeight);
    dbgCtx.fillStyle = 'rgba(0,190,0,0.18)';
    var binary = debugInfo && debugInfo.binary ? debugInfo.binary : buildFreeBinary(snapshotCanvas, pageTopScaled, pageBottomScaled, threshold);
    for(var y = 0; y < binary.height; y += 2){
      for(var x = 0; x < binary.width; x += 2){
        if(binary.data[y * binary.width + x]) dbgCtx.fillRect(x, y, 2, 2);
      }
    }
    function drawRectLabel(rect, color){
      var mmW = Math.round(rect.w * scaleBack / mmToPx(doc, 1));
      var mmH = Math.round(rect.h * scaleBack / mmToPx(doc, 1));
      var label = mmW + '×' + mmH;
      dbgCtx.save();
      dbgCtx.font = '10px Arial';
      var tw = dbgCtx.measureText(label).width;
      var lx = Math.max(0, Math.round(rect.x));
      var ly = Math.max(11, Math.round(rect.y) + 11);
      dbgCtx.fillStyle = 'rgba(255,255,255,0.86)';
      dbgCtx.fillRect(lx, ly - 10, tw + 6, 12);
      dbgCtx.fillStyle = color;
      dbgCtx.fillText(label, lx + 3, ly);
      dbgCtx.restore();
    }
    if(debugInfo && debugInfo.candidates){
      dbgCtx.lineWidth = 1;
      dbgCtx.strokeStyle = 'rgba(0,90,255,0.55)';
      debugInfo.candidates.forEach(function(c){
        dbgCtx.strokeRect(Math.round(c.x) + 0.5, Math.round(c.y) + 0.5, Math.round(c.w), Math.round(c.h));
        drawRectLabel(c, 'rgba(0,90,255,0.9)');
      });
    }
    if(debugInfo && debugInfo.selected){
      dbgCtx.lineWidth = 2.5;
      dbgCtx.strokeStyle = 'rgba(220,0,0,0.95)';
      debugInfo.selected.forEach(function(entry){
        var r = entry.rect;
        dbgCtx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w), Math.round(r.h));
        drawRectLabel(r, 'rgba(220,0,0,0.95)');
      });
    }
    return dbgCanvas.toDataURL('image/png');
  }

  function appendDebugPages(debugPages){
    if(!debugPages || !debugPages.length) return;
    var printDoc = doc.querySelector('.print-doc');
    if(!printDoc) return;
    debugPages.forEach(function(info, idx){
      var isTotallyEmpty = (typeof info.candidateCount === 'number' ? info.candidateCount : 0) === 0 &&
        (typeof info.selectedCount === 'number' ? info.selectedCount : 0) === 0 &&
        Number(info.freePct || 0) >= 99.9 && Number(info.occPct || 0) <= 0.1;
      if(isTotallyEmpty) return;
      var page = doc.createElement('section');
      page.className = 'print-page print-debug-page';
      var content = doc.createElement('div');
      content.className = 'print-page-content';
      var title = doc.createElement('h2');
      title.textContent = 'DEBUG BITMAP — pagina ' + (info.page + 1);
      title.style.fontFamily = 'Arial,Helvetica,sans-serif';
      title.style.fontSize = '14pt';
      title.style.margin = '0 0 4mm 0';
      var meta = doc.createElement('p');
      meta.style.fontFamily = 'Arial,Helvetica,sans-serif';
      meta.style.fontSize = '9pt';
      meta.style.lineHeight = '1.35';
      meta.style.margin = '0 0 4mm 0';
      meta.textContent = 'free=' + info.freePct + '% · occupied=' + info.occPct + '% · candidates=' + (typeof info.candidateCount === 'number' ? info.candidateCount : 0) + ' · selected=' + (typeof info.selectedCount === 'number' ? info.selectedCount : 0) + ' · all-candidates-shown · baseRect=white-only';
      var img = doc.createElement('img');
      img.src = info.dataUrl;
      img.alt = '';
      img.style.display = 'block';
      img.style.width = '100%';
      img.style.maxWidth = '166mm';
      img.style.height = 'auto';
      img.style.border = '0.2mm solid #bbb';
      var legend = doc.createElement('p');
      legend.style.fontFamily = 'Arial,Helvetica,sans-serif';
      legend.style.fontSize = '8.5pt';
      legend.style.margin = '3mm 0 0 0';
      legend.textContent = 'verde = bitmap libera · blu = tutti i rettangoli candidati · rosso = rettangoli selezionati · etichette = mm';
      content.appendChild(title); content.appendChild(meta); content.appendChild(img); content.appendChild(legend);
      page.appendChild(content);
      printDoc.appendChild(page);
    });
  }

  return rasterizePrintDoc().then(function(snapshot){
    var snapshotCanvas = snapshot && snapshot.snapshotCanvas;
    if(!snapshotCanvas) throw new Error('snapshot canvas missing');
    var scaleBack = 1 / snapshot.scale;
    var pageInfos = buildPhysicalPageInfos();
    var pageCount = Math.max(1, pageInfos.length);
    var minRectW = Math.max(8, Math.round(mmToPx(doc, 40) * snapshot.scale));
    var minRectH = Math.max(8, Math.round(mmToPx(doc, 30) * snapshot.scale));
    var eligible = buildEligibleIngredientAssets();
    var usedAssets = Object.create(null);
    var stats = [];
    var pagePromises = [];
    for(var page = 0; page < pageCount; page += 1){
      var pageInfo = pageInfos[page];
      var pageSlice = getPageSliceBounds(pageInfo, snapshot.scale);
      if(!pageSlice) continue;
      var pageTopScaled = Math.max(0, Math.min(snapshotCanvas.height - 1, pageSlice.topScaled));
      var pageBottomScaled = Math.max(pageTopScaled + 1, Math.min(snapshotCanvas.height, pageSlice.bottomScaled));
      var mask = buildFreeMaskDataUrl(snapshotCanvas, pageTopScaled, pageBottomScaled, whiteThreshold);
      var rectInfo = findRectanglesForPage(snapshotCanvas, pageTopScaled, pageBottomScaled, whiteThreshold, minRectW, minRectH, pageInfo, scaleBack);
      var rects = Array.isArray(rectInfo) ? rectInfo : (rectInfo && Array.isArray(rectInfo.selected) ? rectInfo.selected : []);
      var candidates = (rectInfo && Array.isArray(rectInfo.candidates)) ? rectInfo.candidates : [];
      var maxPerPage = Math.min(rects.length, 3);
      var addPromises = [];
      rects.slice(0, maxPerPage).forEach(function(entry){
        var picked = '';
        var assetUrl = '';
        for(var attempt = 0; attempt < 4 && !assetUrl; attempt += 1){
          picked = pickNextAsset(eligible, usedAssets);
          assetUrl = resolveIngredientAssetUrl(picked);
        }
        if(!assetUrl) return;
        addPromises.push(addDecorImage(entry.placement, assetUrl, pageInfo));
      });
      var freePct = ((mask.freePixels / mask.totalPixels) * 100).toFixed(1);
      var occPct = ((mask.occupiedPixels / mask.totalPixels) * 100).toFixed(1);
      var statLine = 'p' + page + ' top=' + pageTopScaled + ' bottom=' + pageBottomScaled + ' canvas=' + snapshotCanvas.width + 'x' + snapshotCanvas.height + ' free=' + freePct + '% occupied=' + occPct + '% candidates=' + candidates.length + ' rects=' + rects.length;
      stats.push(statLine);
      try{ console.log('PAGE', page, {top:pageTopScaled, bottom:pageBottomScaled, canvas:{w:snapshotCanvas.width, h:snapshotCanvas.height}, freePct:freePct, occPct:occPct, candidates:candidates.length, rects:rects.length, assetPool:eligible.pool.length}); }catch(_e){}
      if(rectInfo && !Array.isArray(rectInfo)){
        if(typeof rectInfo.freePct === 'undefined') rectInfo.freePct = freePct;
        if(typeof rectInfo.occPct === 'undefined') rectInfo.occPct = occPct;
        if(typeof rectInfo.page === 'undefined') rectInfo.page = page;
        if(typeof rectInfo.candidateCount === 'undefined') rectInfo.candidateCount = candidates.length;
        if(typeof rectInfo.selectedCount === 'undefined') rectInfo.selectedCount = rects.length;
        rectInfo.dataUrl = buildPageDebugDataUrl(snapshotCanvas, pageTopScaled, pageBottomScaled, whiteThreshold, rectInfo, scaleBack);
        pagePromises.push((function(debugInfo){
          return Promise.all(addPromises).then(function(){ return debugInfo; });
        })(rectInfo));
      }else if(addPromises.length){
        pagePromises.push(Promise.all(addPromises));
      }
    }
    return Promise.all(pagePromises).then(function(results){
      var debugPages = results.filter(function(item){ return item && item.dataUrl; });
      if(false && debugPages.length) appendDebugPages(debugPages);
      try{ console.log('print decor ready', {whiteThreshold:whiteThreshold, rasterScale:rasterScale, stats:stats, minRectMm:'40x30', assetPool:eligible.pool.length}); }catch(_e){}
      return {status:'ok', stats:stats, assetPool:eligible.pool.length};
    });
  }).catch(function(err){
    var msg = (err && (err.message || err.toString())) || 'unknown-error';
    try{ console.error('print mask error', msg); }catch(_e){}
    return {status:'error', error:msg};
  });
}

    function runEditorialPrint(){
      var html = buildPrintDocument();
      if(!html) return;
      var iframe = document.getElementById('recipeEditorialPrintFrame');
      if(iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      iframe = document.createElement('iframe');
      iframe.id = 'recipeEditorialPrintFrame';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);
      var w = iframe.contentWindow;
      var d = iframe.contentDocument || (w && w.document);
      if(!d || !w) return;
      d.open();
      d.write(html);
      d.close();
      var cleanupDone = false;
      function cleanup(){
        if(cleanupDone) return;
        cleanupDone = true;
        setTimeout(function(){ if(iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 800);
      }
      var printTriggered = false;
      function trigger(){
        if(printTriggered) return;
        printTriggered = true;
        try{ w.focus(); w.print(); }catch(e){}
      }
      var prepareStarted = false;
      function prepareAndTrigger(){
        if(prepareStarted) return;
        prepareStarted = true;
        Promise.resolve()
          .then(function(){ return injectPrintIngredientDecor(d); })
          .catch(function(e){ try{ console.error('print decor error', e); }catch(_e){} })
          .finally(function(){
            setTimeout(trigger, 500);
          });
      }
      iframe.onload = function(){ prepareAndTrigger(); };
      w.addEventListener('afterprint', cleanup, {once:true});
      setTimeout(prepareAndTrigger, 600);
      setTimeout(cleanup, 5000);
    }

    
    window.runRecipeEditorialPrintEngine = runEditorialPrint;
    window.recipeEditorialPrint = runEditorialPrint;
})();
