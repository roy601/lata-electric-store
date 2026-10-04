/**
 * Excel template, export and reading for the admin product import.
 * ExcelJS is large, so it is loaded only when one of these functions runs.
 */

const loadExcel = async () => (await import('exceljs')).default;

/* Columns of the "Products" sheet. Spec columns ("Spec: …") are added between
   these and the ID column. `aliases` are other headings we also accept. */
export const COLUMNS = [
  { key: 'name',           header: 'Name *',       width: 38, required: true, aliases: ['name', 'product name', 'product'],
    help: 'Product name as customers will see it.',                         example: 'Walton 12W LED Bulb' },
  { key: 'price',          header: 'Price *',      width: 11, required: true, aliases: ['price', 'selling price', 'sale price'],
    help: 'Selling price in Taka. Numbers only.',                            example: '180' },
  { key: 'stock',          header: 'Stock',        width: 9,  aliases: ['stock', 'qty', 'quantity'],
    help: 'How many you have. Whole number. Blank = 0 for new products.',    example: '50' },
  { key: 'category',       header: 'Category',     width: 24, aliases: ['category'],
    help: 'Pick from the dropdown. A new name creates a new category automatically.', example: 'Home Cooling & Air Comfort' },
  { key: 'subcategory',    header: 'Subcategory',  width: 24, aliases: ['subcategory', 'sub category', 'sub-category', 'subcat', 'group'],
    help: 'Pick from the dropdown — it lists the subcategories of the Category in this row. A new name creates a new subcategory.', example: 'Ceiling Fans' },
  { key: 'brand',          header: 'Brand',        width: 16, aliases: ['brand'],
    help: 'Pick from the dropdown (your existing brands) or type a new one.',                                                 example: 'Walton' },
  { key: 'original_price', header: 'Old Price',    width: 11, aliases: ['old price', 'original price', 'mrp', 'regular price'],
    help: 'Optional. Higher than Price → shown crossed out with "% OFF".',   example: '220' },
  { key: 'sku',            header: 'SKU',          width: 14, aliases: ['sku', 'code', 'product code'],
    help: 'Your own product code. Must be different for every product.',     example: 'WAL-LED-12' },
  { key: 'description',    header: 'Description',  width: 44, aliases: ['description', 'details'],
    help: 'A few sentences about the product.',                              example: 'Energy-saving LED bulb, cool daylight, E27 base.' },
  { key: 'photo',          header: 'Photo',        width: 22, aliases: ['photo', 'image', 'main photo', 'photo file'],
    help: 'Photo file name (e.g. bulb-12w.jpg) or a full web link (https://…).', example: 'bulb-12w.jpg' },
  { key: 'more_photos',    header: 'More Photos',  width: 26, aliases: ['more photos', 'extra photos', 'more images'],
    help: 'Extra photo file names or links, separated by commas.',           example: 'bulb-12w-box.jpg, bulb-12w-side.jpg' },
  { key: 'active',         header: 'Show in Shop', width: 13, aliases: ['show in shop', 'active', 'visible'],
    help: 'Yes or No. Blank = Yes.',                                         example: 'Yes' },
  { key: 'featured',       header: 'Featured',     width: 11, aliases: ['featured'],
    help: 'Yes = show in "Featured Products" on the home page.',              example: 'No' },
  { key: 'top_sell',       header: 'Top Selling',  width: 12, aliases: ['top selling', 'top sell', 'top_sell', 'best seller'],
    help: 'Yes = show in "Top Selling Products" on the home page.',           example: 'No' },
  { key: 'trending',       header: 'Trending',     width: 11, aliases: ['trending'],
    help: 'Yes = show in "Trending Products" on the home page.',              example: 'No' },
  { key: 'flash_price',    header: 'Flash Sale Price', width: 15, aliases: ['flash sale price', 'flash price', 'flash_price'],
    help: 'Optional. A lower price → the product joins the Flash Sale at this price. "No" removes it from the Flash Sale.', example: '' },
];
const ID_HEADER   = 'ID (do not change)';
const SPEC_PREFIX = 'Spec: ';
const OPTION_PREFIX = 'Option: ';
const PROBLEM_HEADER = 'Problem (fix, then delete this column)';
const TEMPLATE_SPECS = ['Wattage', 'Warranty'];
const TEMPLATE_OPTIONS = ['Size'];

/* Options (what customers choose: size, wattage, colour…) are written in one cell:
   "9W, 12W = 180, 15W = 220" — a value, optionally "= its own price". */
export const formatOptions = (options = []) =>
  options.map(o => (o.price != null && o.price !== '' ? `${o.value} = ${o.price}` : o.value)).join(', ');

/** "9W, 12W = 180" → { options: [{ value: '9W', price: null }, { value: '12W', price: 180 }] } or { error } */
export const parseOptions = (text) => {
  const options = [];
  for (const part of String(text).split(/[,;\n]+/).map(x => x.trim()).filter(Boolean)) {
    const [value, price] = part.split('=').map(x => x.trim());
    if (!value) return { error: `"${part}" has no option name` };
    if (price !== undefined && price !== '') {
      const n = parseNumber(price);
      if (!(n > 0)) return { error: `Price "${price}" of option "${value}" is not a number above 0` };
      options.push({ value, price: n });
    } else options.push({ value, price: null });
  }
  return { options };
};

const BLUE = 'FF1E88E5';
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/* ───────────────────────── Writing ───────────────────────── */

/**
 * Builds the workbook. Without `products` it is an empty template with two
 * example rows; with `products` it is an export of the shop's products
 * (including IDs) ready to edit and upload again.
 */
export async function buildWorkbook({ categories: rawCats, subcategories = [], brands = [], specKeysByCat = {}, products = null, problemRows = null }) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Lata Electric Admin';

  const categories = rawCats.map(c => ({ ...c, name: String(c.name || '').trim() })).filter(c => c.name);
  const subsOf = (catId) => subcategories.filter(sc => String(sc.category_id) === String(catId))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(sc => String(sc.header || '').trim()).filter(Boolean);
  const catName = (id) => categories.find(c => String(c.id) === String(id))?.name || '';
  const subName = (id) => String(subcategories.find(sc => String(sc.id) === String(id))?.header || '').trim();
  const yn = (v) => (v ? 'Yes' : 'No');
  // Spec columns for a new template: the spec names your products already use (most common first)
  const shopSpecs = [...new Set(Object.values(specKeysByCat).flat())].slice(0, 8);
  const enabledVariants = (p) => (Array.isArray(p.variants) ? p.variants : []).filter(v => v?.enabled && v.options?.length);
  const specKeys = problemRows ? [...new Set(problemRows.flatMap(r => Object.keys(r.specs || {})))]
    : products ? [...new Set(products.flatMap(p => (Array.isArray(p.specifications) ? p.specifications : []).map(s => s.key?.trim()).filter(Boolean)))]
    : (shopSpecs.length ? shopSpecs : TEMPLATE_SPECS);
  const optionKeys = problemRows ? [...new Set(problemRows.flatMap(r => Object.keys(r.options || {})))]
    : products ? [...new Set(products.flatMap(p => enabledVariants(p).map(v => (v.label || v.key).trim())))]
    : TEMPLATE_OPTIONS;

  addInstructionsSheet(wb, categories);

  /* Products sheet */
  const ws = wb.addWorksheet('Products', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    ...COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width })),
    ...specKeys.map(k => ({ header: SPEC_PREFIX + k, key: 'spec:' + k, width: 16 })),
    ...optionKeys.map(k => ({ header: OPTION_PREFIX + k, key: 'opt:' + k, width: 24 })),
    { header: ID_HEADER, key: 'id', width: 16 },
    ...(problemRows ? [{ header: PROBLEM_HEADER, key: 'problem', width: 60 }] : []),
  ];
  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell, col) => {
    const required = COLUMNS[col - 1]?.required;
    const key = ws.getColumn(col).key || '';
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = fill(key === 'problem' ? 'FFE65100' : key === 'id' ? 'FF9AA5B1' : required ? 'FFC0143C' : key.startsWith('opt:') ? 'FF2E7D32' : BLUE);
    cell.alignment = { vertical: 'middle' };
    const c = COLUMNS[col - 1];
    if (c) cell.note = c.help;
    else if (key === 'id') cell.note = 'Filled in by the shop. Leave as it is — it tells the import which product to update. Empty for new products.';
    else if (key === 'problem') cell.note = 'What was wrong with this row. Fix the row, then import this file again (this column is ignored).';
    else if (key.startsWith('opt:')) cell.note = 'Choices customers pick from, separated by commas. Add "= price" when a choice costs differently. Example: 9W, 12W = 180, 15W = 220';
    else cell.note = 'Specification. Write the value for each product, or leave blank.';
  });

  if (problemRows) {
    problemRows.forEach(r => {
      const row = ws.addRow({
        ...r.values,
        ...Object.fromEntries(Object.entries(r.specs || {}).map(([k, v]) => ['spec:' + k, v])),
        ...Object.fromEntries(Object.entries(r.options || {}).map(([k, v]) => ['opt:' + k, v])),
        problem: r.problem,
      });
      row.getCell('problem').font = { color: { argb: 'FFB71C1C' } };
    });
  } else if (products) {
    products.forEach(p => {
      const specs = Object.fromEntries((Array.isArray(p.specifications) ? p.specifications : []).map(s => ['spec:' + s.key?.trim(), s.value]));
      const opts  = Object.fromEntries(enabledVariants(p).map(v => ['opt:' + (v.label || v.key).trim(), formatOptions(v.options)]));
      ws.addRow({
        name: p.name, price: p.price, stock: p.stock ?? 0, category: catName(p.category_id), subcategory: subName(p.subcategory_id), brand: p.brand || '',
        original_price: p.original_price || '', sku: p.sku || '', description: p.description || '',
        photo: p.image || '', more_photos: (Array.isArray(p.extra_images) ? p.extra_images : []).join(', '),
        active: p.is_active === false ? 'No' : 'Yes', featured: yn(p.featured), top_sell: yn(p.top_sell), trending: yn(p.trending),
        flash_price: p.flash_sale && p.flash_price ? p.flash_price : '', ...specs, ...opts, id: p.id,
      });
    });
  } else {
    const exCat = categories.find(c => subsOf(c.id).length) || categories[0];
    const firstCat = exCat?.name || '';
    const firstSub = exCat ? (subsOf(exCat.id)[0] || '') : '';
    [
      { name: 'EXAMPLE – Walton 12W LED Bulb', price: 180, stock: 50, category: firstCat, subcategory: firstSub, brand: 'Walton', original_price: 220, featured: 'Yes', top_sell: 'No', trending: 'No', sku: 'WAL-LED-12',
        description: 'Energy-saving LED bulb, cool daylight, E27 base.', photo: 'bulb-12w.jpg', more_photos: 'bulb-12w-box.jpg', active: 'Yes',
        'spec:Wattage': '12W', 'spec:Warranty': '1 year' },
      { name: 'EXAMPLE – Super Star Ceiling Fan', price: 3800, stock: 8, category: firstCat, subcategory: firstSub, brand: 'Super Star', sku: 'SS-FAN', flash_price: 3500,
        active: 'Yes', 'spec:Warranty': '2 years', 'opt:Size': '48 inch, 56 inch = 4200' },
      { name: 'EXAMPLE – BRB 1.5 rm Cable (per coil)', price: 2450, stock: 12, category: firstCat, brand: 'BRB', sku: 'BRB-1.5',
        photo: 'https://example.com/brb-cable.jpg', active: 'Yes', 'spec:Warranty': '' },
    ].forEach(r => {
      const row = ws.addRow(r);
      row.eachCell(cell => { cell.font = { italic: true, color: { argb: 'FF8A94A6' } }; cell.fill = fill('FFF4F6F8'); });
    });
  }

  // Dropdowns and number checks (warnings only, so pasting never gets blocked)
  const last = Math.max(1000, ws.rowCount + 500);
  const colLetter = (key) => ws.getColumn(key).letter;
  const cat = colLetter('category');
  if (categories.length) {
    ws.dataValidations.add(`${cat}2:${cat}${last}`, {
      type: 'list', allowBlank: true, formulae: [`Categories!$A$2:$A$${categories.length + 1}`],
      showErrorMessage: true, errorStyle: 'information', errorTitle: 'New category?',
      error: 'This category is not in your shop yet. It will be created when you import. Press OK to keep it.',
    });
    // Subcategory list = the row of the chosen category on the Categories sheet
    const row = `MATCH(TRIM($${cat}2),Categories!$A:$A,0)-1`;
    ws.dataValidations.add(`${colLetter('subcategory')}2:${colLetter('subcategory')}${last}`, {
      type: 'list', allowBlank: true,
      formulae: [`OFFSET(Categories!$B$1,${row},0,1,MAX(1,COUNTA(OFFSET(Categories!$B$1,${row},0,1,60))))`],
      showErrorMessage: true, errorStyle: 'information', errorTitle: 'New subcategory?',
      error: 'This subcategory is not in the chosen category yet. It will be created when you import. Press OK to keep it.',
    });
  }
  if (brands.length) {
    ws.dataValidations.add(`${colLetter('brand')}2:${colLetter('brand')}${last}`, {
      type: 'list', allowBlank: true, formulae: [`Brands!$A$2:$A$${brands.length + 1}`],
      showErrorMessage: true, errorStyle: 'information', errorTitle: 'New brand?', error: 'This brand is new. Press OK to keep it.',
    });
  }
  ['active', 'featured', 'top_sell', 'trending'].forEach(k => ws.dataValidations.add(`${colLetter(k)}2:${colLetter(k)}${last}`, {
    type: 'list', allowBlank: true, formulae: ['"Yes,No"'], showErrorMessage: true, errorStyle: 'warning', error: 'Write Yes or No.',
  }));
  ['price', 'original_price'].forEach(k => ws.dataValidations.add(`${colLetter(k)}2:${colLetter(k)}${last}`, {
    type: 'decimal', operator: 'greaterThan', formulae: [0], allowBlank: true,
    showErrorMessage: true, errorStyle: 'warning', error: 'Numbers only, more than 0 (no ৳ or commas).',
  }));
  ws.dataValidations.add(`${colLetter('stock')}2:${colLetter('stock')}${last}`, {
    type: 'whole', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true,
    showErrorMessage: true, errorStyle: 'warning', error: 'Whole number, 0 or more.',
  });

  /* Categories sheet: each row = a category and its subcategories (feeds both dropdowns) */
  const cs = wb.addWorksheet('Categories', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  const maxSubs = Math.max(1, ...categories.map(c => subsOf(c.id).length));
  cs.columns = [{ width: 36 }, ...Array.from({ length: maxSubs }, () => ({ width: 26 }))];
  cs.addRow(['Category', 'Subcategories of this category →']);
  cs.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill(BLUE); });
  categories.forEach(c => cs.addRow([c.name, ...subsOf(c.id)]));
  cs.addRow([]);
  cs.addRow(['From the website on ' + new Date().toLocaleDateString('en-GB') + '. Download a new template to get the latest lists.']).font = { italic: true, color: { argb: 'FF7F8C9A' } };

  /* Brands sheet */
  const bs = wb.addWorksheet('Brands');
  bs.columns = [{ width: 30 }];
  bs.addRow(['Brands in your shop']).font = { bold: true };
  brands.forEach(b => bs.addRow([b]));

  /* Spec names each category already uses — so new products match old ones */
  const ss = wb.addWorksheet('Spec names');
  ss.columns = [{ width: 36 }, ...Array.from({ length: 10 }, () => ({ width: 18 }))];
  ss.addRow(['Category', 'Spec names already used (make a "Spec: <name>" column for any of these) →']);
  ss.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill(BLUE); });
  categories.forEach(c => ss.addRow([c.name, ...(specKeysByCat[c.id] || [])]));

  return wb;
}

function addInstructionsSheet(wb, categories) {
  const ws = wb.addWorksheet('Instructions', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 4 }, { width: 22 }, { width: 13 }, { width: 62 }, { width: 34 }];
  const add = (cells = [], style = {}) => {
    const row = ws.addRow(['', ...cells]);
    if (style.font) row.eachCell(c => { c.font = style.font; });
    if (style.fill) [2, 3, 4, 5].forEach(i => { row.getCell(i).fill = style.fill; });
    row.alignment = { vertical: 'top', wrapText: true };
    return row;
  };
  const title   = (t) => { const r = add([t], { font: { bold: true, size: 13, color: { argb: BLUE } } }); r.height = 24; };
  const para    = (t) => { const r = add([t]); ws.mergeCells(`B${r.number}:E${r.number}`); r.height = Math.max(16, Math.ceil(t.length / 120) * 16); };
  const blank   = () => add([]);

  const top = add(['LATA ELECTRIC — Product Import Sheet'], { font: { bold: true, size: 18, color: { argb: 'FF0F172A' } } });
  top.height = 30;
  para('Use this file to add many products at once, or to change prices and stock of many products at once.');
  blank();

  title('How to use it (5 steps)');
  [
    '1.  Open the "Products" sheet (tab at the bottom of the screen). Write ONE product per row, starting from row 2 — as many different products as you like in one file.',
    '     The grey rows that start with "EXAMPLE –" are only examples. They are skipped automatically — you can delete them or leave them.',
    '2.  Fill in Name and Price for every product (red headings = required). All other columns are optional.',
    '3.  Category: pick from the dropdown. Then Subcategory: its dropdown shows only the subcategories of that category. A NEW category or subcategory name is created automatically when you import.',
    '4.  Photos: write the photo\'s file name exactly, for example  bulb-12w.jpg  — then choose those photo files in the import window.',
    '     Or paste a full web link that starts with https://. For several extra photos, separate them with commas.',
    '5.  Save the file as Excel (.xlsx). In Admin → Products → Import from Excel: choose the photos (if any), then this file.',
    '     Check the preview — nothing is saved until you press "Import".',
  ].forEach(para);
  blank();

  title('What to write in each column');
  const head = add(['Column', 'Required?', 'What to write', 'Example'], { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: fill(BLUE) });
  head.height = 18;
  COLUMNS.forEach((c, i) => {
    add([c.header.replace(' *', ''), c.required ? 'Required' : 'Optional', c.help, c.example], { fill: fill(i % 2 ? 'FFFFFFFF' : 'FFF4F7FB') });
  });
  add(['Spec: …', 'Optional', 'Specifications. Add a column for each detail, with a heading that starts with "Spec: " — e.g. "Spec: Wattage", "Spec: Base Type". Write the value in each row; blank = not added. Add as many Spec columns as you need.', 'Spec: Wattage → 12W'], { fill: fill('FFF4F7FB') });
  add(['Option: …', 'Optional', 'Choices the customer picks (size, wattage, colour…). One column per kind of choice, with a heading that starts with "Option: " — e.g. "Option: Size". In the cell list the choices separated by commas. If a choice has its own price write "= price" after it. Stock is shared by all choices of a product.', '48 inch, 56 inch = 4200'], { fill: fill('FFF1F8E9') });
  add([ID_HEADER, 'Do not fill', 'Only in files downloaded with "Download my products". It tells the import which product to update. Leave it empty for new products and never change it.', '57']);
  blank();

  title('Options — sizes, wattages, colours (one product, several choices)');
  [
    '•  Add a column whose heading starts with "Option: ", for example  Option: Size  or  Option: Wattage.',
    '•  In the cell write the choices separated by commas:  48 inch, 56 inch',
    '•  A choice that costs a different amount gets "= price":  48 inch, 56 inch = 4200   (48 inch uses the normal Price).',
    '•  Customers must pick a choice before adding the product to their cart. Stock is for the product as a whole.',
    '•  When updating a product, an Option cell replaces that option\'s choices; an empty cell keeps them.',
  ].forEach(para);
  blank();

  title('Changing prices or stock of existing products');
  [
    '•  In the import window, press "Download my products". You get this same sheet filled with all your products and their IDs.',
    '•  Change the prices, stock or anything else, keep the ID column as it is, save, and import the file. Those products are updated — no duplicates are made.',
    '•  A row without an ID but with an SKU that already exists in the shop also updates that product.',
    '•  In an update, an EMPTY cell means "keep the current value" — it does not erase anything.',
    '•  A row without an ID and without a known SKU is added as a NEW product.',
  ].forEach(para);
  blank();

  title('Lists in this file (always up to date when downloaded)');
  [
    '•  "Categories" sheet: every category and its subcategories, as they are on the website right now. The dropdowns read from here.',
    '•  "Brands" sheet: brands already in the shop. "Spec names" sheet: the spec names each category already uses, so new products match.',
    '•  Added a category on the website? Download a new template and it is included.',
  ].forEach(para);
  blank();

  title('Rules and tips');
  [
    '•  Do not change or delete the heading row (row 1). The order of columns does not matter, and you may delete columns you don\'t use (except Name and Price).',
    '•  Price, Old Price and Stock: numbers only. ৳, "Tk" and commas are removed automatically if you type them. Bangla digits (০–৯) also work.',
    '•  Stock must be a whole number, 0 or more.',
    '•  Show in Shop: Yes or No. Blank means Yes. "No" saves the product but hides it from customers.',
    '•  Every SKU must be different. Two rows with the same SKU will be reported as an error.',
    '•  Photos: JPG, PNG or WEBP. Large photos are made smaller automatically. Photo names are not case-sensitive (Bulb.JPG = bulb.jpg).',
    '•  Rows with mistakes are NOT imported. The preview shows which row and what is wrong. Press "Download rows with problems" to get just those rows with the reason next to each — fix them and import that file.',
    '•  The import runs on the server: you may close the window once it says "Saving products". See progress and past imports under "History", where an import can also be undone.',
    '•  After fixing mistakes you can import the same file again. New rows whose name already exists in the shop are skipped (the import window lets you change this), so nothing is added twice.',
  ].forEach(para);
  blank();

  title('সংক্ষেপে (বাংলায়)');
  [
    '১.  নিচের "Products" শিটে প্রতিটি সারিতে একটি করে পণ্য লিখুন। "EXAMPLE –" দিয়ে শুরু ধূসর সারিগুলো শুধু উদাহরণ, এগুলো বাদ দেওয়া হবে।',
    '২.  Name (নাম) এবং Price (দাম) অবশ্যই দিতে হবে। বাকি ঘরগুলো ঐচ্ছিক।',
    '৩.  Category ড্রপডাউন থেকে ক্যাটাগরি বেছে নিন, তারপর Subcategory — সেখানে শুধু ওই ক্যাটাগরির সাব-ক্যাটাগরি দেখাবে। নতুন নাম লিখলে ইমপোর্টের সময় নিজে থেকেই তৈরি হবে।',
    '৪.  সাইজ/ওয়াট ইত্যাদি অপশনের জন্য "Option: Size" এর মতো কলাম দিন, ঘরে কমা দিয়ে লিখুন: 48 inch, 56 inch = 4200',
    '৫.  ছবির জন্য ফাইলের নাম লিখুন (যেমন bulb-12w.jpg), আর ইমপোর্টের সময় সেই ছবিগুলোও বেছে নিন।',
    '৬.  দাম বা স্টক বদলাতে "Download my products" নামিয়ে ঘর বদলান, ID কলাম যেমন আছে তেমন রাখুন, তারপর আবার ইমপোর্ট করুন।',
    '৭.  ফাইলটি .xlsx হিসেবে সেভ করে Admin → Products → Import from Excel-এ দিন। প্রিভিউ দেখে "Import" চাপুন।',
  ].forEach(para);
  blank();

  if (categories.length) {
    title(`Your categories (${categories.length})`);
    para(categories.map(c => c.name).join('   •   '));
  }
}

async function download(wb, filename) {
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const today = () => new Date().toISOString().slice(0, 10);
/** ctx = { categories, subcategories, brands, specKeysByCat } — fetched fresh from the website */
export const downloadTemplate = async (ctx) =>
  download(await buildWorkbook({ ...ctx }), `Lata-Electric-product-template-${today()}.xlsx`);
export const downloadProblemRows = async (ctx, problemRows) =>
  download(await buildWorkbook({ ...ctx, problemRows }), `Lata-Electric-rows-to-fix-${today()}.xlsx`);
export const downloadProducts = async (ctx, products) =>
  download(await buildWorkbook({ ...ctx, products }), `Lata-Electric-products-${today()}.xlsx`);

/* ───────────────────────── Reading ───────────────────────── */

const norm = (h) => String(h || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Plain text of any ExcelJS cell value (rich text, formulas, links, dates…). */
const cellText = (v) => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('').trim();
    if ('result' in v) return cellText(v.result);
    if ('text' in v) return cellText(v.text);
    if (v.hyperlink) return String(v.hyperlink).trim();
    if (v.error) return '';
    return '';
  }
  return String(v).trim();
};

/**
 * Reads an uploaded .xlsx file.
 * @returns {{ rows: Array<{ rowNumber, values: Record<string,string>, specs: Record<string,string> }>, ignoredColumns: string[], sheetName: string }}
 * Throws an Error with a readable message when the file can't be used.
 */
export async function readProductFile(file) {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error('Please choose an Excel .xlsx file. (In Excel or Google Sheets use "Save as / Download → .xlsx".)');
  }
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); }
  catch { throw new Error('This file could not be opened. Make sure it is a real Excel (.xlsx) file and not password-protected.'); }

  const ws = wb.getWorksheet('Products')
    || wb.worksheets.find(s => !['instructions', 'categories'].includes(s.name.toLowerCase()));
  if (!ws) throw new Error('No "Products" sheet found in this file. Please use the template.');

  // Map heading → field
  const colMap = {};          // column number → { key } | { spec }
  const ignoredColumns = [];
  ws.getRow(1).eachCell((cell, col) => {
    const raw = cellText(cell.value);
    const h = norm(raw);
    if (!h) return;
    const spec = raw.match(/^\s*spec\s*[:\-–]\s*(.+)$/i);
    if (spec) { colMap[col] = { spec: spec[1].trim() }; return; }
    const opt = raw.match(/^\s*option\s*[:\-–]\s*(.+)$/i);
    if (opt) { colMap[col] = { option: opt[1].trim() }; return; }
    if (h.startsWith('problem')) return;
    if (h.startsWith('id')) { colMap[col] = { key: 'id' }; return; }
    const c = COLUMNS.find(c => c.aliases.includes(h));
    if (c) colMap[col] = { key: c.key };
    else ignoredColumns.push(raw);
  });
  const keys = Object.values(colMap).map(m => m.key);
  if (!keys.includes('name') || !keys.includes('price')) {
    throw new Error('The heading row must have "Name" and "Price" columns. Please use the template and keep row 1 unchanged.');
  }

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = {}, specs = {}, options = {};
    Object.entries(colMap).forEach(([col, m]) => {
      const t = cellText(row.getCell(+col).value);
      if (!t) return;
      if (m.spec) specs[m.spec] = t; else if (m.option) options[m.option] = t; else values[m.key] = t;
    });
    if (Object.keys(values).length || Object.keys(specs).length || Object.keys(options).length) rows.push({ rowNumber, values, specs, options });
  });
  return { rows, ignoredColumns, sheetName: ws.name };
}

/** "৳1,250 Tk" / "১২৫০" → 1250 (NaN when not a number). */
export const parseNumber = (s) => {
  const t = String(s).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/৳|tk\.?|taka|,|\s/gi, '');
  return t === '' ? NaN : Number(t);
};
