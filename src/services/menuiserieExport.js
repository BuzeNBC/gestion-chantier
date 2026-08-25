import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  typeLabel, statusLabel, orderInterventions, billingLabel, orderRelances,
  effectiveBillingStatus,
} from './menuiserieService';

// =============================================================================
// Export mensuel des interventions de menuiserie (CSV + PDF)
// =============================================================================
// Une "ligne" d'export = une intervention d'un bon, enrichie des infos du bon
// (adresse, client, BT, chargé d'affaire…).
//
// Date de référence d'une intervention (pour l'affectation au mois) :
//   1. intervention.completed_date si présente (travail réellement fait ce jour)
//   2. sinon order.scheduled_date (prévu ce mois)
//   3. sinon order.created_at (bon créé ce mois)
// =============================================================================

// Date de référence d'une intervention, au format Date (ou null).
export const interventionRefDate = (order, iv) => {
  const raw = iv.completed_date || order.scheduled_date || order.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Aplatis les bons -> lignes d'intervention pour un mois donné.
// `yearMonth` au format 'YYYY-MM' (valeur d'un <input type="month">).
// `statuses` : liste des statuts à inclure ('todo'|'in_progress'|'completed').
//   Si omis/vide, tous les statuts sont inclus.
// Retourne les lignes triées par adresse puis par date.
export const collectMonthRows = (orders, yearMonth, statuses = null) => {
  const statusSet = statuses && statuses.length > 0 ? new Set(statuses) : null;
  const rows = [];
  for (const order of orders || []) {
    for (const iv of orderInterventions(order)) {
      if (statusSet && !statusSet.has(iv.status || 'todo')) continue;
      const d = interventionRefDate(order, iv);
      if (!d) continue;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (ym !== yearMonth) continue;
      rows.push({
        date: d,
        address: order.address || '(adresse non renseignée)',
        client: order.client_name || '',
        phone: order.client_phone || '',
        bt: order.bt_number || '',
        chargeAffaire: order.charge_affaire || '',
        menuisier: order.assigned_profile?.Name || '',
        reference: order.reference || '',
        type: typeLabel(iv.type),
        status: statusLabel(iv.status),
        rawStatus: iv.status,
        scheduled: order.scheduled_date || '',
        completed: iv.completed_date || '',
        measurementsCount: (iv.measurements || []).length,
        photosCount: (iv.photos || []).length,
        notes: iv.notes || '',
        priceHt: Number.isFinite(Number(iv.price_ht)) && iv.price_ht !== null && iv.price_ht !== ''
          ? Number(iv.price_ht) : null,
        // Vide tant que le bon n'est pas terminé (pas encore facturable)
        billing: effectiveBillingStatus(order) ? billingLabel(effectiveBillingStatus(order)) : '',
        relancesCount: orderRelances(order).length,
      });
    }
  }
  rows.sort((a, b) =>
    a.address.localeCompare(b.address, 'fr') || a.date - b.date
  );
  return rows;
};

const fmtDate = (d) => {
  if (!d) return '';
  const dd = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dd.getTime()) ? '' : dd.toLocaleDateString('fr-FR');
};

// Libellé lisible d'un mois 'YYYY-MM' → 'juin 2026'
export const monthLabel = (yearMonth) => {
  const [y, m] = (yearMonth || '').split('-').map(Number);
  if (!y || !m) return yearMonth;
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};

// ============================================================== CSV ==========
// Génère et télécharge un CSV. Séparateur ';' (convention Excel FR) et BOM
// UTF-8 pour que les accents s'affichent correctement dans Excel.
export const exportMonthCsv = (orders, yearMonth, statuses = null) => {
  const rows = collectMonthRows(orders, yearMonth, statuses);
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    'Mois', 'Adresse', 'Client', 'Téléphone', 'N° de BT', 'Chargé d\'affaire',
    'Menuisier', 'Référence', 'Date', 'Date prévue', 'Date réalisation',
    'Intervention', 'Statut', 'Prix HT (€)', 'Facturation', 'Relances',
    'Nb cotes', 'Nb photos', 'Notes',
  ];
  const lines = [header.join(';')];
  for (const r of rows) {
    lines.push([
      monthLabel(yearMonth),
      esc(r.address),
      esc(r.client),
      esc(r.phone),
      esc(r.bt),
      esc(r.chargeAffaire),
      esc(r.menuisier),
      esc(r.reference),
      fmtDate(r.date),
      fmtDate(r.scheduled),
      fmtDate(r.completed),
      esc(r.type),
      esc(r.status),
      // Décimale à virgule pour Excel FR
      r.priceHt !== null ? String(r.priceHt.toFixed(2)).replace('.', ',') : '',
      esc(r.billing),
      r.relancesCount || '',
      r.measurementsCount,
      r.photosCount,
      esc(r.notes),
    ].join(';'));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `menuiserie-${yearMonth}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return rows.length;
};

// ============================================================== PDF ==========
// PDF récapitulatif du mois, groupé par adresse. Même charte que les autres
// PDF du module (bleu foncé, A3 portrait, pied de page).
export const exportMonthPdf = async (orders, yearMonth, statuses = null) => {
  const rows = collectMonthRows(orders, yearMonth, statuses);

  const pdfDoc = await PDFDocument.create();
  const PAGE_WIDTH = 842;
  const PAGE_HEIGHT = 1191;
  const MARGIN = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(0.12, 0.29, 0.49);
  const textColor = rgb(0.1, 0.1, 0.1);
  const headerTextColor = rgb(1, 1, 1);
  const backgroundColor = rgb(0.98, 0.98, 0.98);
  const mutedColor = rgb(0.45, 0.45, 0.45);

  const clean = (t) => String(t ?? '')
    .replace(/[≥]/g, '>=').replace(/[≤]/g, '<=')
    .replace(/[—–]/g, '-').replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'").replace(/[…]/g, '...');

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y;

  const drawHeader = (isFirst) => {
    const h = isFirst ? 90 : 46;
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - h, width: PAGE_WIDTH, height: h, color: primaryColor });
    if (isFirst) {
      page.drawText('RÉCAPITULATIF MENUISERIE', {
        x: MARGIN, y: PAGE_HEIGHT - 38, size: 22, font: helveticaBold, color: headerTextColor,
      });
      page.drawText(clean(monthLabel(yearMonth)), {
        x: MARGIN, y: PAGE_HEIGHT - 64, size: 14, font: helvetica, color: headerTextColor,
      });
      const count = `${rows.length} intervention${rows.length > 1 ? 's' : ''}`;
      const cw = helvetica.widthOfTextAtSize(count, 12);
      page.drawText(count, {
        x: PAGE_WIDTH - MARGIN - cw, y: PAGE_HEIGHT - 64, size: 12, font: helvetica, color: headerTextColor,
      });
      return PAGE_HEIGHT - h - 24;
    }
    page.drawText(`${clean(monthLabel(yearMonth))} (suite)`, {
      x: MARGIN, y: PAGE_HEIGHT - 30, size: 12, font: helveticaBold, color: headerTextColor,
    });
    return PAGE_HEIGHT - h - 18;
  };

  y = drawHeader(true);

  if (rows.length === 0) {
    page.drawText('Aucune intervention sur ce mois.', {
      x: MARGIN, y, size: 12, font: helvetica, color: mutedColor,
    });
  }

  // Groupement par adresse (rows déjà triées par adresse)
  let currentAddress = null;
  const colX = {
    date: MARGIN,
    type: MARGIN + 70,
    status: MARGIN + 340,
    bt: MARGIN + 420,
    ca: MARGIN + 500,
    extra: MARGIN + 610,
    price: MARGIN + 690,
  };

  const ensureSpace = (needed) => {
    if (y - needed < MARGIN + 30) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawHeader(false);
      // Répète l'en-tête d'adresse sur la nouvelle page pour la lisibilité
      if (currentAddress) {
        page.drawText(`${clean(currentAddress)} (suite)`, {
          x: MARGIN, y, size: 11, font: helveticaBold, color: primaryColor,
        });
        y -= 18;
      }
    }
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    // Nouvel en-tête d'adresse
    if (r.address !== currentAddress) {
      currentAddress = r.address;
      ensureSpace(60);
      y -= 6;
      page.drawRectangle({ x: MARGIN, y: y - 5, width: CONTENT_WIDTH, height: 22, color: primaryColor });
      page.drawText(clean(r.address).slice(0, 90), {
        x: MARGIN + 8, y: y + 1, size: 11, font: helveticaBold, color: headerTextColor,
      });
      y -= 24;
      // Sous-ligne client
      if (r.client) {
        page.drawText(clean(`Client : ${r.client}${r.phone ? ' — ' + r.phone : ''}`), {
          x: MARGIN + 8, y, size: 9, font: helvetica, color: mutedColor,
        });
        y -= 14;
      }
      // En-têtes de colonnes
      page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_WIDTH, height: 15, color: backgroundColor });
      page.drawText('Date', { x: colX.date + 2, y, size: 8, font: helveticaBold, color: mutedColor });
      page.drawText('Intervention', { x: colX.type, y, size: 8, font: helveticaBold, color: mutedColor });
      page.drawText('Statut', { x: colX.status, y, size: 8, font: helveticaBold, color: mutedColor });
      page.drawText('N° BT', { x: colX.bt, y, size: 8, font: helveticaBold, color: mutedColor });
      page.drawText('Chargé d\'aff.', { x: colX.ca, y, size: 8, font: helveticaBold, color: mutedColor });
      page.drawText('Cotes/Photos', { x: colX.extra, y, size: 8, font: helveticaBold, color: mutedColor });
      page.drawText('Prix HT', { x: colX.price, y, size: 8, font: helveticaBold, color: mutedColor });
      y -= 16;
    }

    ensureSpace(16);
    if (i % 2 === 0) {
      page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_WIDTH, height: 15, color: backgroundColor });
    }
    page.drawText(fmtDate(r.date), { x: colX.date + 2, y, size: 8, font: helvetica, color: textColor });
    page.drawText(clean(r.type).slice(0, 55), { x: colX.type, y, size: 8, font: helvetica, color: textColor });
    page.drawText(clean(r.status), { x: colX.status, y, size: 8, font: helvetica, color: textColor });
    page.drawText(clean(r.bt).slice(0, 14), { x: colX.bt, y, size: 8, font: helvetica, color: textColor });
    page.drawText(clean(r.chargeAffaire).slice(0, 20), { x: colX.ca, y, size: 8, font: helvetica, color: textColor });
    page.drawText(`${r.measurementsCount} / ${r.photosCount}`, { x: colX.extra, y, size: 8, font: helvetica, color: textColor });
    if (r.priceHt !== null) {
      page.drawText(`${r.priceHt.toFixed(2).replace('.', ',')} EUR`, { x: colX.price, y, size: 8, font: helvetica, color: textColor });
    }
    y -= 15;
  }

  // Résumé global en fin de document
  if (rows.length > 0) {
    ensureSpace(60);
    y -= 10;
    const done = rows.filter((r) => r.rawStatus === 'completed').length;
    const inProg = rows.filter((r) => r.rawStatus === 'in_progress').length;
    const todo = rows.filter((r) => r.rawStatus === 'todo').length;
    const addresses = new Set(rows.map((r) => r.address)).size;
    const totalHt = rows.reduce((s, r) => s + (r.priceHt || 0), 0);
    page.drawRectangle({ x: MARGIN, y: y - 8, width: CONTENT_WIDTH, height: 26, color: backgroundColor });
    page.drawText(
      clean(`Total : ${rows.length} interventions sur ${addresses} adresse${addresses > 1 ? 's' : ''} — ${done} terminée${done > 1 ? 's' : ''}, ${inProg} en cours, ${todo} à faire${totalHt > 0 ? ` — ${totalHt.toFixed(2).replace('.', ',')} EUR HT` : ''}`),
      { x: MARGIN + 8, y, size: 10, font: helveticaBold, color: primaryColor },
    );
  }

  // Pieds de page
  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    p.drawText(`Page ${idx + 1}/${pages.length}`, {
      x: PAGE_WIDTH / 2 - 25, y: 20, size: 9, font: helvetica, color: primaryColor,
    });
    p.drawText(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, {
      x: MARGIN, y: 20, size: 9, font: helvetica, color: mutedColor,
    });
  });

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const isMobile = /iphone|ipad|ipod|android|mobile|tablet/i.test(navigator.userAgent);
  if (isMobile) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `recap-menuiserie-${yearMonth}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    window.open(url, '_blank');
  }
  return rows.length;
};
