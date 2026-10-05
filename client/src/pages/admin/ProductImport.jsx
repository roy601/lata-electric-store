import { useEffect, useMemo, useState } from 'react';
import { X, FileSpreadsheet, Download, Images, Upload, CheckCircle2, AlertTriangle, XCircle, History, Undo2 } from 'lucide-react';
import { uploadImage, getProducts, getCategories, getSubcategories, createSubcategory, getProductMeta, lookupProducts, startImport, getImports, getImport, undoImport, errMsg } from '../../api/adminApi';
import { compressImage } from '../../lib/compressImage';
import { downloadTemplate, downloadProducts, downloadProblemRows, readProductFile, parseNumber, parseOptions } from '../../lib/productExcel';
import { quickCreateCategory } from './CategoryPanel';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import toast from 'react-hot-toast';

const PHOTO_PARALLEL = 3;  // photo uploads at once
const POLL_MS = 1500;

const fileKey   = (name) => String(name).trim().toLowerCase();
const stripExt  = (name) => fileKey(name).replace(/\.[a-z0-9]+$/, '');
const isUrl     = (s) => /^https?:\/\//i.test(s);
const splitList = (s) => String(s).split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
const YES = ['yes', 'y', 'true', '1', 'হ্যাঁ', 'show'];
const NO  = ['no', 'n', 'false', '0', 'না', 'hide'];
const BUILT_IN = { size: 'size', color: 'color', colour: 'color', warranty: 'warranty' };

// Same shapes the product form uses (old object format → list)
const toVariantList = (variants) => {
  if (!variants) return [];
  if (Array.isArray(variants)) return variants.map(v => ({ ...v, options: [...(v.options || [])] }));
  return Object.entries(variants).map(([key, v]) => ({
    key, label: key.toUpperCase(), enabled: !!v.enabled,
    options: (v.options || []).map(o => (typeof o === 'string' ? { value: o, price: null } : o)),
  }));
};
const variantFor = (label, options) => {
  const lc = label.trim().toLowerCase();
  const key = BUILT_IN[lc] || `custom_${lc.replace(/[^a-z0-9]+/g, '_')}`;
  return { key, label: label.trim().toUpperCase(), enabled: true, options };
};

/**
 * Turns the sheet rows into a checked plan: what each row will do, its problems,
 * and the data to send. Nothing is saved here.
 *   known – existing products that matter for this file (from /products/lookup)
 */
const subKey = (catId, name) => `${catId}::${String(name).trim().toLowerCase()}`;

function analyse(rows, { known, categories, subcategories = [], photoMap, skipExisting, createCats }) {
  const catByName = new Map(categories.map(c => [c.name.trim().toLowerCase(), c]));
  const subByKey  = new Map(subcategories.map(sc => [subKey(sc.category_id, sc.header), sc]));
  const seenSku = new Map(), seenId = new Map(), seenNewName = new Map();

  const findPhoto = (ref) => {
    if (isUrl(ref)) return { url: ref };
    const f = photoMap.get(fileKey(ref)) || photoMap.get(stripExt(ref));
    return f ? { file: f } : null;
  };

  return rows.map(({ rowNumber, values: v, specs, options = {} }) => {
    const errors = [], warnings = [];
    const name = (v.name || '').trim();
    if (/^example\b/i.test(name)) return { rowNumber, name, action: 'skip', errors, warnings: ['Example row — skipped'] };

    // Which product does this row mean?
    let target = null;
    if (v.id) {
      target = known.byId.get(parseNumber(v.id));
      if (!target) errors.push(`ID ${v.id} is not a product in the shop. Leave ID empty for new products.`);
      if (seenId.has(v.id)) errors.push(`Same ID as row ${seenId.get(v.id)}`); else seenId.set(v.id, rowNumber);
    } else if (v.sku && known.bySku.has(v.sku.trim().toLowerCase())) {
      target = known.bySku.get(v.sku.trim().toLowerCase());
    }
    if (v.sku) {
      const k = v.sku.trim().toLowerCase();
      if (seenSku.has(k)) errors.push(`Same SKU as row ${seenSku.get(k)}`); else seenSku.set(k, rowNumber);
    }
    const isNew = !target && !v.id;

    const data = {};
    let newCategory = null, newSubcategory = null;
    if (isNew && !name) errors.push('Name is missing');
    if (name) data.name = name;

    if (v.price !== undefined) {
      const n = parseNumber(v.price);
      if (!(n > 0)) errors.push(`Price "${v.price}" is not a number above 0`); else data.price = n;
    } else if (isNew) errors.push('Price is missing');

    if (v.stock !== undefined) {
      const n = parseNumber(v.stock);
      if (!Number.isInteger(n) || n < 0) errors.push(`Stock "${v.stock}" must be a whole number (0 or more)`); else data.stock = n;
    } else if (isNew) data.stock = 0;

    if (v.original_price !== undefined) {
      const n = parseNumber(v.original_price);
      if (!(n > 0)) errors.push(`Old Price "${v.original_price}" is not a number above 0`);
      else {
        data.original_price = n;
        const price = data.price ?? target?.price;
        if (price && n <= price) warnings.push('Old Price is not higher than Price — no discount will show');
      }
    }

    if (v.category !== undefined) {
      const c = catByName.get(v.category.trim().toLowerCase());
      if (c) data.category_id = c.id;
      else if (createCats) { newCategory = v.category.trim(); warnings.push(`New category "${newCategory}" will be created`); }
      else errors.push(`Category "${v.category}" doesn't exist. Pick one from the dropdown, or turn on "Create new categories & subcategories".`);
    } else if (isNew) warnings.push('No category — product will be hard to find in the shop');

    // Subcategory belongs to the row's category (or the product's current one when updating)
    const rowCatId = data.category_id ?? (newCategory ? null : target?.category_id ?? null);
    const rowCatName = newCategory || categories.find(c => c.id === rowCatId)?.name?.trim();
    if (v.subcategory !== undefined) {
      const sub = v.subcategory.trim();
      if (!rowCatName) { if (v.category === undefined) errors.push(`Subcategory "${sub}" needs a Category in the same row`); }
      else {
        const found = rowCatId != null && subByKey.get(subKey(rowCatId, sub));
        if (found) data.subcategory_id = found.id;
        else if (createCats) { newSubcategory = sub; warnings.push(`New subcategory "${sub}" will be created in "${rowCatName}"`); }
        else errors.push(`"${rowCatName}" has no subcategory "${sub}". Pick one from the dropdown, or turn on "Create new categories & subcategories".`);
      }
    } else if (target && data.category_id != null && data.category_id !== target.category_id) {
      data.subcategory_id = null;   // moved to another category → old subcategory no longer fits
    }

    // Home-page sections and Flash Sale
    [['featured', 'Featured'], ['top_sell', 'Top Selling'], ['trending', 'Trending']].forEach(([k, label]) => {
      if (v[k] === undefined) return;
      const a = v[k].trim().toLowerCase();
      if (YES.includes(a)) data[k] = true;
      else if (NO.includes(a)) data[k] = false;
      else errors.push(`${label} "${v[k]}" must be Yes or No`);
    });
    if (v.flash_price !== undefined) {
      const t = v.flash_price.trim().toLowerCase();
      if (NO.includes(t)) { data.flash_sale = false; data.flash_price = null; }
      else {
        const n = parseNumber(v.flash_price);
        const base = data.price ?? target?.price;
        if (!(n > 0)) errors.push(`Flash Sale Price "${v.flash_price}" is not a number above 0 (write "No" to remove from Flash Sale)`);
        else if (base && n >= base) errors.push(`Flash Sale Price ৳${n} must be lower than the Price ৳${base}`);
        else { data.flash_sale = true; data.flash_price = n; }
      }
    }

    if (v.active !== undefined) {
      const a = v.active.trim().toLowerCase();
      if (YES.includes(a)) data.is_active = true;
      else if (NO.includes(a)) data.is_active = false;
      else errors.push(`Show in Shop "${v.active}" must be Yes or No`);
    } else if (isNew) data.is_active = true;

    if (v.brand !== undefined)       data.brand = v.brand;
    if (v.sku !== undefined && v.sku.trim().toLowerCase() !== target?.sku?.trim().toLowerCase()) data.sku = v.sku.trim();
    if (v.description !== undefined) data.description = v.description;

    // Specifications: new → as written; update → change only the specs in the sheet
    const sheetSpecs = Object.entries(specs).map(([key, value]) => ({ key, value }));
    if (sheetSpecs.length) {
      if (target) {
        const merged = (Array.isArray(target.specifications) ? target.specifications : []).map(s => ({ ...s }));
        sheetSpecs.forEach(s => {
          const i = merged.findIndex(m => m.key?.trim().toLowerCase() === s.key.toLowerCase());
          if (i >= 0) merged[i].value = s.value; else merged.push(s);
        });
        data.specifications = merged;
      } else data.specifications = sheetSpecs;
    } else if (isNew) data.specifications = [];

    // Options (sizes, wattages…): new → as written; update → replace only the options in the sheet
    const sheetOptions = [];
    Object.entries(options).forEach(([label, text]) => {
      const parsed = parseOptions(text);
      if (parsed.error) errors.push(`Option "${label}": ${parsed.error}`);
      else if (parsed.options.length) sheetOptions.push(variantFor(label, parsed.options));
    });
    if (sheetOptions.length) {
      const list = target ? toVariantList(target.variants) : [];
      sheetOptions.forEach(sv => {
        const i = list.findIndex(v => v.key === sv.key || (v.label || '').trim().toLowerCase() === sv.label.toLowerCase());
        if (i >= 0) list[i] = { ...list[i], enabled: true, options: sv.options }; else list.push(sv);
      });
      data.variants = list;
    }

    // Photos
    let photo = null; const extras = [];
    if (v.photo !== undefined) {
      photo = findPhoto(v.photo);
      if (!photo) warnings.push(`Photo "${v.photo}" was not chosen — saved without this photo`);
    }
    if (v.more_photos !== undefined) {
      splitList(v.more_photos).forEach(ref => {
        const p = findPhoto(ref);
        if (p) extras.push(p); else warnings.push(`Photo "${ref}" was not chosen — skipped`);
      });
    }

    // Already in the shop? (protects against importing the same file twice)
    if (isNew && name && !errors.length) {
      const k = name.toLowerCase();
      if (seenNewName.has(k)) warnings.push(`Same name as row ${seenNewName.get(k)}`); else seenNewName.set(k, rowNumber);
      if (known.names.has(k)) {
        if (skipExisting) return { rowNumber, name, action: 'skip', errors, warnings: ['A product with this name is already in the shop — skipped'] };
        warnings.push('A product with this name is already in the shop — another one will be added');
      }
    }

    if (target && !errors.length && !Object.keys(data).length && !photo && !extras.length) {
      return { rowNumber, name: name || target.name, action: 'skip', errors, warnings: ['Nothing to change'] };
    }

    return {
      rowNumber, name: name || target?.name || '(no name)',
      action: errors.length ? 'error' : target ? 'update' : 'new',
      targetId: target?.id, errors, warnings, data, newCategory, newSubcategory, rowCatId, photo, extras,
      price: data.price ?? target?.price, stock: data.stock ?? target?.stock,
    };
  });
}

/** Upload with a few retries — the API allows ~200 requests a minute. */
async function uploadWithRetry(file) {
  const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.85 });
  for (let attempt = 0; ; attempt++) {
    try { return (await uploadImage(compressed)).data.url; }
    catch (err) {
      if (attempt >= 3) throw err;
      const wait = err?.response?.status === 429 ? 20000 : 1500 * (attempt + 1);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

const ACTION_STYLE = {
  new:    { label: 'New',    bg: '#E8F5E9', fg: '#1B5E20' },
  update: { label: 'Update', bg: '#E3F2FD', fg: '#0D47A1' },
  skip:   { label: 'Skip',   bg: '#F1F3F5', fg: '#6B7280' },
  error:  { label: 'Error',  bg: '#FDECEA', fg: '#B71C1C' },
};
const STATUS_STYLE = {
  running:     { label: 'Running',      bg: '#E3F2FD', fg: '#0D47A1' },
  done:        { label: 'Finished',     bg: '#E8F5E9', fg: '#1B5E20' },
  failed:      { label: 'Stopped',      bg: '#FDECEA', fg: '#B71C1C' },
  interrupted: { label: 'Interrupted',  bg: '#FFF8E1', fg: '#856404' },
  undone:      { label: 'Undone',       bg: '#F1F3F5', fg: '#6B7280' },
};
const when = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export default function ProductImport({ categories, onClose, onDone, onCategoriesChanged }) {
  const { isMobile } = useBreakpoint();
  const [tab,      setTab]      = useState('import');   // 'import' | 'history'
  const [photos,   setPhotos]   = useState([]);
  const [sheet,    setSheet]    = useState(null);   // { fileName, rows, ignoredColumns, known }
  const [reading,  setReading]  = useState(false);
  const [readErr,  setReadErr]  = useState('');
  const [skipExisting, setSkipExisting] = useState(true);
  const [createCats,   setCreateCats]   = useState(true);   // new categories/subcategories are created automatically
  const [subcategories, setSubcategories] = useState([]);
  const loadSubcategories = () => getSubcategories().then(({ data }) => setSubcategories(data.subcategories || [])).catch(() => {});
  useEffect(() => { loadSubcategories(); }, []);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [progress, setProgress] = useState('');
  const [job,      setJob]      = useState(null);   // server import record while running / finished
  const [downloading, setDownloading] = useState('');
  const [history,  setHistory]  = useState(null);
  const [undoing,  setUndoing]  = useState(null);

  const photoMap = useMemo(() => {
    const m = new Map();
    photos.forEach(f => { m.set(fileKey(f.name), f); m.set(stripExt(f.name), f); });
    return m;
  }, [photos]);

  const plan = useMemo(() => sheet ? analyse(sheet.rows, { known: sheet.known, categories, subcategories, photoMap, skipExisting, createCats }) : [],
    [sheet, categories, subcategories, photoMap, skipExisting, createCats]);
  const count = (a) => plan.filter(r => r.action === a).length;
  const toImport = plan.filter(r => r.action === 'new' || r.action === 'update');
  const withWarnings = plan.filter(r => r.action !== 'skip' && r.warnings.length).length;
  const shown = onlyProblems ? plan.filter(r => r.action === 'error' || (r.action !== 'skip' && r.warnings.length)) : plan;
  const jobRunning = job?.status === 'running';

  /* ── Follow a server import until it finishes ── */
  useEffect(() => {
    if (!job?.id || job.status !== 'running') return;
    const t = setTimeout(async () => {
      try {
        const { data } = await getImport(job.id);
        setJob(data.import);
        if (data.import.status !== 'running') onDone();
      } catch { setJob(j => ({ ...j })); /* try again */ }
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [job]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = async () => {
    try { const { data } = await getImports(); setHistory(data.imports); }
    catch (err) { toast.error(errMsg(err, 'Could not load history')); setHistory([]); }
  };
  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab]);
  // keep running imports in the history list moving
  useEffect(() => {
    if (tab !== 'history' || !history?.some(h => h.status === 'running')) return;
    const t = setTimeout(loadHistory, POLL_MS * 2);
    return () => clearTimeout(t);
  }, [tab, history]);

  /* Read the website's current lists, so every downloaded file is up to date */
  const liveLists = async () => {
    const [cRes, sRes, mRes] = await Promise.all([getCategories(), getSubcategories(), getProductMeta()]);
    return {
      categories:    cRes.data.categories || [],
      subcategories: sRes.data.subcategories || [],
      brands:        mRes.data.brands || [],
      specKeysByCat: mRes.data.specKeys || {},
    };
  };

  const doDownload = async (kind) => {
    setDownloading(kind);
    try {
      const ctx = await liveLists();
      if (kind === 'template') await downloadTemplate(ctx);
      else {
        const { data } = await getProducts();   // every product, paged on the server
        await downloadProducts(ctx, data.products || []);
      }
    } catch (err) { toast.error('Could not create the file: ' + errMsg(err)); }
    setDownloading('');
  };

  /* Rows with errors (from the preview, plus rows the server refused) as an Excel file to fix */
  const downloadProblems = async () => {
    if (!sheet) return;
    const byRow = new Map(sheet.rows.map(r => [r.rowNumber, r]));
    const problems = new Map();
    plan.filter(r => r.action === 'error').forEach(r => problems.set(r.rowNumber, r.errors.join('; ')));
    (job?.errors || []).forEach(e => { if (e.row) problems.set(e.row, [problems.get(e.row), e.error].filter(Boolean).join('; ')); });
    const rows = [...problems.entries()].sort((a, b) => a[0] - b[0]).map(([rowNumber, problem]) => {
      const r = byRow.get(rowNumber);
      return { values: r?.values || {}, specs: r?.specs || {}, options: r?.options || {}, problem: `Row ${rowNumber}: ${problem}` };
    });
    if (!rows.length) { toast('No rows with problems'); return; }
    setDownloading('problems');
    try { await downloadProblemRows(await liveLists(), rows); } catch (err) { toast.error('Could not create the file: ' + errMsg(err)); }
    setDownloading('');
  };

  const chooseSheet = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setReading(true); setReadErr(''); setSheet(null); setJob(null);
    try {
      const data = await readProductFile(file);
      if (!data.rows.length) throw new Error('The "Products" sheet has no product rows. Write products from row 2 down.');
      // Ask the server only about the products this file mentions
      const lc = (x) => String(x || '').trim().toLowerCase();
      const { data: found } = await lookupProducts({
        ids:   data.rows.map(r => parseNumber(r.values.id)).filter(Number.isInteger),
        skus:  data.rows.map(r => r.values.sku).filter(Boolean),
        names: data.rows.map(r => r.values.name).filter(Boolean),
      });
      const byId = new Map(found.products.map(p => [p.id, p]));
      const known = {
        byId,
        bySku: new Map(Object.entries(found.skuIndex).map(([sku, id]) => [lc(sku), byId.get(id)]).filter(([, p]) => p)),
        names: new Set(Object.keys(found.nameIndex).map(lc)),
      };
      setSheet({ fileName: file.name, ...data, known });
    } catch (err) { setReadErr(err.response ? errMsg(err) : err.message); }
    setReading(false);
  };

  const runImport = async () => {
    if (!toImport.length || busy) return;
    setBusy(true); setJob(null);
    try {
      // 1. New categories (only if asked)
      const catId = new Map(categories.map(c => [c.name.trim().toLowerCase(), c.id]));
      const newNames = [...new Set(toImport.map(r => r.newCategory).filter(Boolean))];
      if (newNames.length) {
        let list = [...categories];
        for (const name of newNames) {
          if (catId.has(name.toLowerCase())) continue;
          setProgress(`Creating category "${name}"…`);
          const cat = await quickCreateCategory(name, list);
          if (!cat) throw new Error(`Could not create category "${name}"`);
          list = [...list, cat];
          catId.set(name.toLowerCase(), cat.id);
        }
        onCategoriesChanged?.();
      }

      // 1b. New subcategories, inside their (existing or just-created) category
      const subId = new Map(subcategories.map(sc => [subKey(sc.category_id, sc.header), sc.id]));
      const rowCat = (r) => r.data.category_id ?? (r.newCategory ? catId.get(r.newCategory.toLowerCase()) : r.rowCatId);
      let createdSubs = 0;
      for (const r of toImport.filter(x => x.newSubcategory)) {
        const cid = rowCat(r);
        const key = subKey(cid, r.newSubcategory);
        if (!cid || subId.has(key)) continue;
        setProgress(`Creating subcategory "${r.newSubcategory}"…`);
        const order = subcategories.filter(sc => sc.category_id === cid).length + createdSubs;
        const { data } = await createSubcategory({ category_id: cid, header: r.newSubcategory, items: [], sort_order: order });
        subId.set(key, data.item.id);
        createdSubs++;
      }
      if (createdSubs) loadSubcategories();

      // 2. Upload the photo files the rows use (each file once)
      const files = [...new Set(toImport.flatMap(r => [r.photo, ...r.extras].filter(p => p?.file).map(p => p.file)))];
      const urlOf = new Map();
      let photoFails = 0;
      for (let i = 0; i < files.length; i += PHOTO_PARALLEL) {
        setProgress(`Uploading photos… ${Math.min(i + PHOTO_PARALLEL, files.length)} of ${files.length} (keep this window open)`);
        await Promise.all(files.slice(i, i + PHOTO_PARALLEL).map(async f => {
          try { urlOf.set(f, await uploadWithRetry(f)); } catch { photoFails++; }
        }));
      }
      if (photoFails) toast(`${photoFails} photo(s) could not be uploaded — those products are saved without them`, { duration: 6000 });
      const resolve = (p) => p?.url || (p?.file && urlOf.get(p.file)) || null;

      // 3. Hand everything to the server, which saves it in the background
      setProgress('Sending to the server…');
      const rows = toImport.map(r => {
        const body = { ...r.data };
        if (r.targetId) body.id = r.targetId;
        if (r.newCategory) body.category_id = catId.get(r.newCategory.toLowerCase());
        if (r.newSubcategory) body.subcategory_id = subId.get(subKey(rowCat(r), r.newSubcategory)) ?? null;
        const main = resolve(r.photo);
        if (main) body.image = main;
        if (r.extras.length) body.extra_images = r.extras.map(resolve).filter(Boolean);
        return { row: r.rowNumber, name: r.name, data: body };
      });
      const { data } = await startImport({ file_name: sheet.fileName, rows });
      setJob({ id: data.id, status: 'running', total: rows.length, processed: 0, added: 0, updated: 0, failed: 0, errors: [] });
    } catch (err) {
      toast.error('Import could not start: ' + errMsg(err), { duration: 6000 });
    } finally {
      setBusy(false); setProgress('');
    }
  };

  const undo = async (imp) => {
    const parts = [imp.added && `the ${imp.added} product(s) it added will be DELETED`, imp.updated && `the ${imp.updated} product(s) it changed get their old values back`].filter(Boolean);
    if (!window.confirm(`Undo import #${imp.id}${imp.file_name ? ` (${imp.file_name})` : ''}?\n\n${parts.join(', and ')}.\n\nChanges made to those products after the import will be lost.`)) return;
    setUndoing(imp.id);
    try {
      const { data } = await undoImport(imp.id);
      toast.success(`Undone: ${data.removed} removed, ${data.restored} restored${data.restoreFailed ? `, ${data.restoreFailed} could not be restored` : ''}`, { duration: 6000 });
      onDone();
      if (job?.id === imp.id) setJob(j => ({ ...j, status: 'undone' }));
    } catch (err) { toast.error(errMsg(err, 'Undo failed')); }
    setUndoing(null);
    if (tab === 'history') loadHistory();
  };

  const card = { background: 'var(--bg-fff, #fff)', border: '1px solid var(--bd-e8ecf1, #e8ecf1)', borderRadius: 12, padding: isMobile ? 14 : 18, marginBottom: 12 };
  const stepNo = (n) => <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#1E88E5', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>;
  const btn = (primary) => ({ padding: '9px 14px', background: primary ? '#1E88E5' : 'var(--bg-f1f3f5, #F1F3F5)', color: primary ? '#fff' : 'var(--tx-374151, #374151)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 });
  const chip = (bg, fg, text) => <span style={{ background: bg, color: fg, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{text}</span>;
  const tabBtn = (key, label, Icon) => (
    <button onClick={() => setTab(key)}
      style={{ padding: '9px 14px', border: 'none', borderBottom: `2px solid ${tab === key ? '#1E88E5' : 'transparent'}`, background: 'none', color: tab === key ? 'var(--tx-1565c0, #1565C0)' : 'var(--tx-6b7280, #6B7280)', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon size={15} /> {label}
    </button>
  );
  const problemCount = count('error') + (job?.errors?.filter(e => e.row).length || 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? 0 : '28px 16px', overflowY: 'auto' }}>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      <div style={{ background: 'var(--bg-f6f8fa, #F6F8FA)', borderRadius: isMobile ? 0 : 14, width: '100%', maxWidth: 860, minHeight: isMobile ? '100%' : undefined }}>

        {/* Header */}
        <div style={{ background: 'var(--bg-fff, #fff)', borderRadius: isMobile ? 0 : '14px 14px 0 0', padding: isMobile ? '14px 16px 0' : '18px 22px 0', borderBottom: '1px solid var(--bd-eef1f4, #eef1f4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSpreadsheet size={22} color="#1D6F42" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Import products from Excel</div>
              <div style={{ fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)' }}>Add many products, or change prices and stock of many products, in one go.</div>
            </div>
            <button onClick={onClose} disabled={busy} aria-label="Close" title={jobRunning ? 'You can close — the import continues on the server' : 'Close'}
              style={{ background: 'var(--bg-f3f4f6, #F3F4F6)', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {tabBtn('import', 'Import', Upload)}
            {tabBtn('history', 'History', History)}
          </div>
        </div>

        <div style={{ padding: isMobile ? 12 : 20 }}>

        {tab === 'history' ? (
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Recent imports</div>
            <div style={{ fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)', marginBottom: 12 }}>Undo removes the products an import added and puts back the old values of products it changed.</div>
            {history === null ? <div style={{ color: 'var(--tx-9aa5b1, #9aa5b1)', fontSize: 13 }}>Loading…</div>
              : history.length === 0 ? <div style={{ color: 'var(--tx-9aa5b1, #9aa5b1)', fontSize: 13 }}>No imports yet.</div>
              : history.map(h => {
                const st = STATUS_STYLE[h.status] || STATUS_STYLE.done;
                const canUndo = h.status !== 'running' && h.status !== 'undone' && (h.added || h.updated);
                return (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--bd-f0f2f5, #f0f2f5)', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>#{h.id} · {h.file_name || 'Excel import'}</div>
                      <div style={{ fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)' }}>
                        {when(h.created_at)} · {h.added} added · {h.updated} updated{h.failed ? ` · ${h.failed} failed` : ''}
                        {h.status === 'running' && ` · ${h.processed} of ${h.total} done`}
                        {h.status === 'undone' && h.undone_at && ` · undone ${when(h.undone_at)}`}
                      </div>
                    </div>
                    {chip(st.bg, st.fg, st.label)}
                    {canUndo ? (
                      <button onClick={() => undo(h)} disabled={undoing === h.id}
                        style={{ ...btn(false), padding: '6px 10px', fontSize: 12, color: 'var(--tx-b71c1c, #B71C1C)' }}>
                        <Undo2 size={13} /> {undoing === h.id ? 'Undoing…' : 'Undo'}
                      </button>
                    ) : null}
                  </div>
                );
              })}
          </div>
        ) : <>

          {/* Step 1 — get the sheet */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>{stepNo(1)}<span style={{ fontWeight: 800 }}>Get the Excel sheet and fill it in</span></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <button onClick={() => doDownload('template')} disabled={!!downloading} style={btn(true)}>
                <Download size={15} /> {downloading === 'template' ? 'Preparing…' : 'Download empty template (latest lists)'}
              </button>
              <button onClick={() => doDownload('products')} disabled={!!downloading} style={btn(false)}>
                <Download size={15} /> {downloading === 'products' ? 'Preparing…' : 'Download my products'}
              </button>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--tx-4b5563, #4B5563)', lineHeight: 1.75 }}>
              <li><strong>New products:</strong> use the empty template. One product per row in the <em>Products</em> sheet. <strong>Name</strong> and <strong>Price</strong> are required.</li>
              <li><strong>Change prices / stock:</strong> download your products, edit the cells, keep the <em>ID</em> column as it is, then import. Empty cells keep the current value.</li>
              <li><strong>One row per product</strong> — as many different products as you like in one file.</li>
              <li><strong>Category &amp; Subcategory:</strong> pick from the dropdowns (the subcategory list follows the category you chose). A new name creates it automatically.</li>
              <li><strong>Featured / Top Selling / Trending:</strong> Yes or No. <strong>Flash Sale Price:</strong> a lower price puts the product in the Flash Sale.</li>
              <li><strong>Specs:</strong> columns named like <em>Spec: Wattage</em>. <strong>Options</strong> customers choose: columns like <em>Option: Size</em> with <em>48 inch, 56 inch = 4200</em>.</li>
              <li><strong>Photos:</strong> write the file name (e.g. <em>bulb-12w.jpg</em>) and choose those photos in step 2 — or paste a web link.</li>
              <li>Full instructions (also in Bangla) are in the <em>Instructions</em> sheet inside the file.</li>
            </ul>
          </div>

          {/* Step 2 — photos */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>{stepNo(2)}<span style={{ fontWeight: 800 }}>Choose photos</span><span style={{ fontSize: 12, color: 'var(--tx-9aa5b1, #9aa5b1)' }}>optional — only if the sheet has photo file names</span></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ ...btn(false), cursor: busy ? 'not-allowed' : 'pointer' }}>
                <Images size={15} /> {photos.length ? 'Add more photos' : 'Choose photos'}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} disabled={busy}
                  onChange={e => { const fs = Array.from(e.target.files); e.target.value = ''; setPhotos(p => [...p, ...fs.filter(f => !p.some(x => fileKey(x.name) === fileKey(f.name)))]); }} />
              </label>
              {photos.length > 0 && <>
                <span style={{ fontSize: 13, color: 'var(--tx-374151, #374151)' }}><strong>{photos.length}</strong> photo{photos.length !== 1 ? 's' : ''} chosen</span>
                <button onClick={() => setPhotos([])} disabled={busy} style={{ background: 'none', border: 'none', color: '#DC3545', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Clear</button>
              </>}
            </div>
            {photos.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--tx-7f8c9a, #7f8c9a)', marginTop: 8, lineHeight: 1.6 }}>
                {photos.slice(0, 12).map(f => f.name).join(', ')}{photos.length > 12 ? ` and ${photos.length - 12} more` : ''}
              </div>
            )}
          </div>

          {/* Step 3 — the sheet */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>{stepNo(3)}<span style={{ fontWeight: 800 }}>Choose your filled Excel file</span></div>
            <label style={{ ...btn(true), cursor: busy || reading || jobRunning ? 'not-allowed' : 'pointer' }}>
              <Upload size={15} /> {reading ? 'Reading…' : sheet ? 'Choose a different file' : 'Choose .xlsx file'}
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }} onChange={chooseSheet} disabled={busy || reading || jobRunning} />
            </label>
            {sheet && <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--tx-374151, #374151)' }}>{sheet.fileName} — {sheet.rows.length} rows</span>}
            {readErr && <div style={{ marginTop: 10, background: 'var(--bg-fdecea, #FDECEA)', color: 'var(--tx-b71c1c, #B71C1C)', padding: '10px 12px', borderRadius: 8, fontSize: 13 }}>{readErr}</div>}
            {sheet?.ignoredColumns.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--tx-856404, #856404)', background: 'var(--bg-fff8e1, #FFF8E1)', padding: '8px 12px', borderRadius: 8 }}>
                These columns were not recognised and are ignored: <strong>{sheet.ignoredColumns.join(', ')}</strong>. (Spec columns start with "Spec: ", option columns with "Option: ".)
              </div>
            )}
          </div>

          {/* Preview */}
          {sheet && !job && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontWeight: 800, marginRight: 4 }}>Check before importing</span>
                {chip('#E8F5E9', '#1B5E20', `${count('new')} new`)}
                {chip('#E3F2FD', '#0D47A1', `${count('update')} update`)}
                {count('error') > 0 && chip('#FDECEA', '#B71C1C', `${count('error')} with errors (not imported)`)}
                {withWarnings > 0 && chip('#FFF8E1', '#856404', `${withWarnings} with warnings`)}
                {count('skip') > 0 && chip('#F1F3F5', '#6B7280', `${count('skip')} skipped`)}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, marginBottom: 10 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={createCats} onChange={e => setCreateCats(e.target.checked)} />
                  Create new categories &amp; subcategories
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)} />
                  Skip new rows whose name is already in the shop
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={onlyProblems} onChange={e => setOnlyProblems(e.target.checked)} />
                  Show only rows with problems
                </label>
              </div>

              <div style={{ border: '1px solid var(--bd-eef1f4, #eef1f4)', borderRadius: 8, maxHeight: 380, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-f8f9fa, #F8F9FA)', zIndex: 1 }}>
                    <tr>{['Row', 'Product', !isMobile && 'Price', !isMobile && 'Stock', 'Result'].filter(Boolean).map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--tx-7f8c9a, #7f8c9a)', fontWeight: 700, borderBottom: '1px solid var(--bd-eef1f4, #eef1f4)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {shown.slice(0, 500).map(r => {
                      const st = ACTION_STYLE[r.action];
                      return (
                        <tr key={r.rowNumber} style={{ borderBottom: '1px solid var(--bd-f4f6f8, #f4f6f8)', verticalAlign: 'top', opacity: r.action === 'skip' ? .6 : 1 }}>
                          <td style={{ padding: '7px 10px', color: 'var(--tx-9aa5b1, #9aa5b1)' }}>{r.rowNumber}</td>
                          <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--tx-212529, #212529)' }}>
                            {r.name || '—'}
                            {r.errors.map((e, i) => <div key={'e' + i} style={{ color: 'var(--tx-b71c1c, #B71C1C)', fontWeight: 500, fontSize: 12, display: 'flex', gap: 4, marginTop: 2 }}><XCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{e}</div>)}
                            {r.action !== 'skip' && r.warnings.map((w, i) => <div key={'w' + i} style={{ color: 'var(--tx-8a6d00, #8a6d00)', fontWeight: 500, fontSize: 12, display: 'flex', gap: 4, marginTop: 2 }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{w}</div>)}
                            {r.action === 'skip' && <div style={{ color: 'var(--tx-6b7280, #6B7280)', fontWeight: 400, fontSize: 12 }}>{r.warnings[0]}</div>}
                          </td>
                          {!isMobile && <td style={{ padding: '7px 10px' }}>{r.price != null ? `৳${r.price}` : '—'}</td>}
                          {!isMobile && <td style={{ padding: '7px 10px' }}>{r.stock ?? '—'}</td>}
                          <td style={{ padding: '7px 10px' }}><span style={{ background: st.bg, color: st.fg, padding: '2px 9px', borderRadius: 12, fontWeight: 700, fontSize: 11 }}>{st.label}</span></td>
                        </tr>
                      );
                    })}
                    {shown.length === 0 && <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--tx-9aa5b1, #9aa5b1)' }}>No problems found.</td></tr>}
                  </tbody>
                </table>
                {shown.length > 500 && <div style={{ padding: 10, fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)', textAlign: 'center' }}>Showing the first 500 rows. All rows will be imported.</div>}
              </div>

              {count('error') > 0 && (
                <div style={{ fontSize: 12, color: 'var(--tx-6b7280, #6B7280)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span>Rows with errors are skipped. Import the rest now, then fix those rows and import them.</span>
                  <button onClick={downloadProblems} disabled={!!downloading} style={{ ...btn(false), padding: '6px 10px', fontSize: 12 }}>
                    <Download size={13} /> {downloading === 'problems' ? 'Preparing…' : `Download rows with problems (${count('error')})`}
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                <button onClick={runImport} disabled={busy || !toImport.length}
                  style={{ ...btn(true), padding: '11px 22px', fontSize: 14, opacity: busy || !toImport.length ? .6 : 1, cursor: busy ? 'wait' : toImport.length ? 'pointer' : 'not-allowed' }}>
                  {busy ? 'Working…' : `Import ${toImport.length} product${toImport.length !== 1 ? 's' : ''}`}
                </button>
                {progress && <span style={{ fontSize: 13, color: 'var(--tx-374151, #374151)' }}>{progress}</span>}
              </div>
            </div>
          )}

          {/* Server job: progress, then result */}
          {job && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                {jobRunning ? <span style={{ width: 20, height: 20, border: '3px solid #E3F2FD', borderTop: '3px solid #1E88E5', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                  : job.failed || job.status !== 'done' ? <AlertTriangle size={22} color="#E65100" /> : <CheckCircle2 size={22} color="#2E7D32" />}
                <span style={{ fontWeight: 800, fontSize: 16 }}>
                  {jobRunning ? 'Saving products…' : job.status === 'undone' ? 'Import undone' : job.status === 'done' ? 'Import finished' : 'Import stopped'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--tx-9aa5b1, #9aa5b1)' }}>#{job.id}</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg-eef2f6, #EEF2F6)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${job.total ? Math.round(job.processed / job.total * 100) : 0}%`, background: jobRunning ? '#1E88E5' : '#43A047', transition: 'width .4s' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--tx-374151, #374151)', marginRight: 4 }}>{job.processed} of {job.total} rows</span>
                {chip('#E8F5E9', '#1B5E20', `${job.added} added`)}
                {chip('#E3F2FD', '#0D47A1', `${job.updated} updated`)}
                {job.failed > 0 && chip('#FDECEA', '#B71C1C', `${job.failed} failed`)}
              </div>
              {jobRunning && <div style={{ fontSize: 12, color: 'var(--tx-7f8c9a, #7f8c9a)', marginBottom: 10 }}>This runs on the server — you can close this window and check progress later under History.</div>}
              {job.status === 'interrupted' && <div style={{ fontSize: 13, color: 'var(--tx-856404, #856404)', marginBottom: 10 }}>The server restarted during the import. Rows saved so far are kept — import the file again (already-added rows are skipped by name or SKU).</div>}
              {job.errors?.length > 0 && (
                <div style={{ fontSize: 13, background: 'var(--bg-fdecea, #FDECEA)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
                  {job.errors.slice(0, 100).map((e, i) => <div key={i}>{e.row ? `Row ${e.row}` : ''}{e.name ? ` — ${e.name}` : ''}: {e.error}</div>)}
                </div>
              )}
              {!jobRunning && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={onClose} style={btn(true)}>Done</button>
                  {problemCount > 0 && (
                    <button onClick={downloadProblems} disabled={!!downloading} style={btn(false)}>
                      <Download size={14} /> Download rows with problems ({problemCount})
                    </button>
                  )}
                  <button onClick={() => { setJob(null); setSheet(null); }} style={btn(false)}>Import another file</button>
                  {job.status !== 'undone' && (job.added > 0 || job.updated > 0) && (
                    <button onClick={() => undo(job)} disabled={undoing === job.id} style={{ ...btn(false), color: 'var(--tx-b71c1c, #B71C1C)' }}>
                      <Undo2 size={14} /> {undoing === job.id ? 'Undoing…' : 'Undo this import'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>}
        </div>
      </div>
    </div>
  );
}
