
from bs4 import BeautifulSoup
import os


REQUIRED_META_KEYS = ["Autore", "Categoria", "Origine", "Fonte"]


def list_recipe_slugs(site_root):
    recipes_dir = os.path.join(site_root, "ricette")
    if not os.path.isdir(recipes_dir):
        return []
    items = []
    for name in sorted(os.listdir(recipes_dir)):
        if os.path.isfile(os.path.join(recipes_dir, name, "index.html")):
            items.append(name)
    return items


def _new_tag(soup, name, attrs=None, text=None):
    tag = soup.new_tag(name, **(attrs or {}))
    if text is not None:
        tag.string = text
    return tag


def _find_main(soup):
    return soup.select_one("main") or soup.body or soup


def _find_meta_grid(main):
    return main.select_one(".meta-grid")


def _extract_meta(meta_grid):
    data = {k: "" for k in REQUIRED_META_KEYS}
    if not meta_grid:
        return data
    for card in meta_grid.select(".meta-card"):
        strong = card.find("strong")
        span = card.find("span")
        if not strong:
            continue
        key = strong.get_text(" ", strip=True).replace(":", "")
        if key in data:
            data[key] = span.get_text(" ", strip=True) if span else ""
    return data


def _make_meta_card(soup, key, value=""):
    card = soup.new_tag("div", **{"class": "meta-card"})
    strong = soup.new_tag("strong")
    strong.string = key
    span = soup.new_tag("span")
    span.string = value
    card.append(strong)
    card.append(span)
    return card


def _ensure_meta_grid(soup, main):
    h1 = main.find("h1")
    meta_grid = _find_meta_grid(main)
    if meta_grid is None:
        meta_grid = soup.new_tag("div", **{"class": "meta-grid"})
        if h1 is not None:
            h1.insert_after(meta_grid)
        else:
            main.insert(0, meta_grid)

    existing = {}
    for card in list(meta_grid.select(".meta-card")):
        strong = card.find("strong")
        span = card.find("span")
        if not strong:
            continue
        key = strong.get_text(" ", strip=True).replace(":", "")
        if key in REQUIRED_META_KEYS:
            existing[key] = span.get_text(" ", strip=True) if span else ""
    meta_grid.clear()
    for key in REQUIRED_META_KEYS:
        meta_grid.append(_make_meta_card(soup, key, existing.get(key, "")))
    return meta_grid


def _find_section_by_heading(main, title):
    for section in main.find_all("section"):
        h2 = section.find("h2")
        if h2 and h2.get_text(" ", strip=True) == title:
            return section
    return None


def _make_lead(soup):
    section = soup.new_tag("section", **{"class": "lead"})
    h2 = soup.new_tag("h2")
    h2.string = "Introduzione e contesto"
    section.append(h2)
    p = soup.new_tag("p")
    p.string = ""
    section.append(p)
    return section


def _make_ingredients(soup):
    section = soup.new_tag("section", **{"class": "block"})
    h2 = soup.new_tag("h2")
    h2.string = "Ingredienti"
    section.append(h2)

    wrap = soup.new_tag("div", **{"class": "table-wrap"})
    table = soup.new_tag("table", **{"class": "recipe-table"})
    thead = soup.new_tag("thead")
    trh = soup.new_tag("tr")
    for label in ["Ingrediente", "Quantità", "Unità", "Note"]:
        th = soup.new_tag("th")
        th.string = label
        trh.append(th)
    thead.append(trh)
    tbody = soup.new_tag("tbody")
    table.append(thead)
    table.append(tbody)
    wrap.append(table)
    section.append(wrap)
    return section


def _make_preparation(soup):
    section = soup.new_tag("section", **{"class": "block"})
    h2 = soup.new_tag("h2")
    h2.string = "Preparazione"
    section.append(h2)
    steps = soup.new_tag("ol", **{"class": "steps"})
    li = soup.new_tag("li")
    li.string = ""
    steps.append(li)
    section.append(steps)
    return section


def _make_notes(soup):
    section = soup.new_tag("section", **{"class": "notes"})
    h2 = soup.new_tag("h2")
    h2.string = "Note e osservazioni"
    section.append(h2)
    p = soup.new_tag("p")
    p.string = ""
    section.append(p)
    return section


def ensure_required_structure(soup, main):
    meta_grid = _ensure_meta_grid(soup, main)

    lead = _find_section_by_heading(main, "Introduzione e contesto")
    if lead is None:
        lead = _make_lead(soup)
        meta_grid.insert_after(lead)

    ingredients = _find_section_by_heading(main, "Ingredienti")
    if ingredients is None:
        ingredients = _make_ingredients(soup)
        lead.insert_after(ingredients)

    preparation = _find_section_by_heading(main, "Preparazione")
    if preparation is None:
        preparation = _make_preparation(soup)
        ingredients.insert_after(preparation)

    notes = _find_section_by_heading(main, "Note e osservazioni")
    if notes is None:
        notes = _make_notes(soup)
        preparation.insert_after(notes)

    return {
        "meta_grid": meta_grid,
        "lead": lead,
        "ingredients": ingredients,
        "preparation": preparation,
        "notes": notes,
    }




def _ensure_editable_content(refs, soup):
    lead = refs["lead"]
    if lead and not any(child.name in {"p", "figure", "div", "ul", "ol"} for child in lead.find_all(recursive=False) if child.name != "h2"):
        p = soup.new_tag("p")
        p.string = ""
        lead.append(p)

    notes = refs["notes"]
    if notes and not any(child.name in {"p", "figure", "div", "ul", "ol"} for child in notes.find_all(recursive=False) if child.name != "h2"):
        p = soup.new_tag("p")
        p.string = ""
        notes.append(p)

    ingredients = refs["ingredients"]
    if ingredients:
        tbody = ingredients.select_one("table.recipe-table tbody")
        if tbody and not tbody.find("tr"):
            tr = soup.new_tag("tr")
            for _ in range(4):
                td = soup.new_tag("td")
                td.string = ""
                tr.append(td)
            tbody.append(tr)

    preparation = refs["preparation"]
    if preparation:
        steps = preparation.select_one("ol.steps")
        if steps and not steps.find("li"):
            li = soup.new_tag("li")
            li.string = ""
            steps.append(li)


def load_recipe(site_root, slug):
    path = os.path.join(site_root, "ricette", slug, "index.html")
    with open(path, encoding="utf-8") as f:
        html = f.read()
    soup = BeautifulSoup(html, "html.parser")

    main = _find_main(soup)
    refs = ensure_required_structure(soup, main)
    _ensure_editable_content(refs, soup)

    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    h1 = soup.find("h1")
    meta_grid = _find_meta_grid(main)

    return {
        "slug": slug,
        "title": title,
        "h1": h1.get_text(" ", strip=True) if h1 else slug,
        "meta": _extract_meta(meta_grid),
        "html": str(main),
    }
