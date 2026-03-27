from bs4 import BeautifulSoup
import os
import shutil
import re
from datetime import datetime
from services.loader import ensure_required_structure, _ensure_editable_content


def _backup(path):
    backup_dir = os.path.join(os.path.dirname(os.path.dirname(path)), "CMS2-R5-backup", os.path.basename(os.path.dirname(path)))
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copy2(path, os.path.join(backup_dir, f"{ts}-index.html"))


def _slugify(value):
    value = (value or '').strip().lower()
    value = re.sub(r'[^a-z0-9àèéìòù\-\s]', '', value)
    value = value.replace('à', 'a').replace('è', 'e').replace('é', 'e').replace('ì', 'i').replace('ò', 'o').replace('ù', 'u')
    value = re.sub(r'\s+', '-', value)
    value = re.sub(r'-+', '-', value).strip('-')
    return value or 'nuova-ricetta'


def _new_recipe_html(title, meta):
    return f'''<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} – Ricettario Piccotti</title>
<link rel="stylesheet" href="../../style.css">
</head>
<body>
<div class="page">
<header class="site-header">
  <a class="brand" href="../../index.html">Ricettario Piccotti</a>
  <nav><a href="../../indici/ingredienti.html">Ingredienti</a><a href="../../indici/fonti.html">Fonti</a><a href="../../indici/geografia.html">Geografia</a></nav>
</header>
<main>
  <h1>{title}</h1>
  <div class="meta-grid">
    <div class="meta-card"><strong>Autore</strong><span>{meta.get('Autore','')}</span></div>
    <div class="meta-card"><strong>Categoria</strong><span>{meta.get('Categoria','')}</span></div>
    <div class="meta-card"><strong>Origine</strong><span>{meta.get('Origine','')}</span></div>
    <div class="meta-card"><strong>Fonte</strong><span>{meta.get('Fonte','')}</span></div>
  </div>
  <section class="lead">
    <h2>Introduzione e contesto</h2>
    <p></p>
  </section>
  <section class="block">
    <h2>Ingredienti</h2>
    <div class="table-wrap">
      <table class="recipe-table">
        <thead><tr><th>Ingrediente</th><th>Quantità</th><th>Unità</th><th>Note</th></tr></thead>
        <tbody><tr><td></td><td></td><td></td><td></td></tr></tbody>
      </table>
    </div>
  </section>
  <section class="block">
    <h2>Preparazione</h2>
    <ol class="steps"><li></li></ol>
  </section>
  <section class="notes">
    <h2>Note e osservazioni</h2>
    <p></p>
  </section>
</main>
</div>
</body>
</html>'''


def _apply_figure_style(fig):
    role = fig.get('data-role', 'body')
    anchor = fig.get('data-anchor', 'float')
    width = fig.get('data-width', '42')
    try:
        width = max(18, min(95, int(float(width))))
    except Exception:
        width = 42 if anchor == 'float' else 64
    if role == 'cover':
        anchor = 'block'
        width = max(width, 64)
        fig['data-anchor'] = 'block'
    img = fig.find('img')
    if img:
        img['style'] = 'display:block;width:100%;height:auto;'
    if anchor == 'float':
        fig['style'] = f'float:right;clear:right;width:{width}%;margin:0.15rem 0 1rem 1rem;'
    else:
        fig['style'] = f'float:none;display:block;width:{width}%;margin:1rem auto;'
    if role == 'cover':
        fig['style'] = f'float:none;display:block;width:{width}%;margin:0 auto 1rem;'


def create_recipe(site_root, payload):
    title = (payload.get('title') or '').strip() or 'Nuova ricetta'
    slug = _slugify(payload.get('slug') or title)
    recipe_dir = os.path.join(site_root, 'ricette', slug)
    if os.path.exists(recipe_dir):
        raise ValueError('Slug già esistente')
    os.makedirs(recipe_dir, exist_ok=True)
    os.makedirs(os.path.join(site_root, 'foto', slug), exist_ok=True)
    html = _new_recipe_html(title, payload.get('meta', {}))
    with open(os.path.join(recipe_dir, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    return slug


def save_recipe(site_root, slug, payload):
    path = os.path.join(site_root, 'ricette', slug, 'index.html')
    _backup(path)

    with open(path, encoding='utf-8') as f:
        original_html = f.read()

    soup = BeautifulSoup(original_html, 'html.parser')
    new_main_soup = BeautifulSoup(payload['html'], 'html.parser')

    current_main = soup.select_one('main')
    incoming_main = new_main_soup.select_one('main') or new_main_soup

    if current_main is not None:
        current_main.replace_with(incoming_main)
    else:
        if soup.body:
            soup.body.append(incoming_main)
        else:
            soup.append(incoming_main)

    main = soup.select_one('main') or incoming_main
    refs = ensure_required_structure(soup, main)
    _ensure_editable_content(refs, soup)

    h1 = main.find('h1')
    if h1 and payload.get('h1'):
        h1.string = payload['h1']
    title = soup.find('title')
    if title and payload.get('h1'):
        title.string = f"{payload['h1']} – Ricettario Piccotti"

    meta = payload.get('meta', {})
    meta_grid = refs['meta_grid']
    if meta_grid and meta:
        for card in meta_grid.select('.meta-card'):
            strong = card.find('strong')
            span = card.find('span')
            if not strong or not span:
                continue
            key = strong.get_text(' ', strip=True).replace(':', '')
            if key in meta:
                span.string = meta.get(key, '')

    for fig in main.select('figure'):
        _apply_figure_style(fig)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(str(soup))
