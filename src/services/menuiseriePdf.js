import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { typeLabel, statusLabel, MENUISERIE_PHOTO_CATEGORIES } from './menuiserieService';

// Génère un PDF complet pour un bon de menuiserie (en-tête, détails, cotes,
// photos, notes) et l'ouvre dans un nouvel onglet (desktop) ou retourne le
// blob/url pour téléchargement (mobile).
//
// Ré-utilise la même librairie (pdf-lib), la même mise en page A3, les mêmes
// couleurs et le même style que la génération PDF existante côté chantier,
// pour assurer la cohérence visuelle.
//
// Retour : { pdfBytes, blob, url }
export async function generateMenuiseriePdf(order) {
  if (!order) throw new Error('Aucun bon fourni');

  const pdfDoc = await PDFDocument.create();

  // A3 portrait
  const PAGE_WIDTH = 842;
  const PAGE_HEIGHT = 1191;
  const MARGIN = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const primaryColor = rgb(0.12, 0.29, 0.49);
  const textColor = rgb(0.1, 0.1, 0.1);
  const headerTextColor = rgb(1, 1, 1);
  const backgroundColor = rgb(0.98, 0.98, 0.98);
  const mutedColor = rgb(0.45, 0.45, 0.45);

  // Nettoyage de texte : remplace les caractères que pdf-lib + Helvetica ne
  // gèrent pas (≥, em-dash, guillemets typographiques, …) et garde les
  // accents Latin-1 supportés.
  const cleanText = (text) => {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/[≥]/g, '>=')
      .replace(/[≤]/g, '<=')
      .replace(/[—–]/g, '-')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[…]/g, '...');
  };

  const drawHeader = (isFirstPage = false) => {
    const headerHeight = isFirstPage ? 110 : 50;
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - headerHeight,
      width: PAGE_WIDTH,
      height: headerHeight,
      color: primaryColor,
    });

    if (isFirstPage) {
      page.drawText('BON DE MENUISERIE', {
        x: MARGIN, y: PAGE_HEIGHT - 40, size: 24, font: helveticaBold, color: headerTextColor,
      });
      const typeText = cleanText(typeLabel(order.type));
      page.drawText(typeText, {
        x: MARGIN, y: PAGE_HEIGHT - 70, size: 14, font: helvetica, color: headerTextColor,
      });
      if (order.reference) {
        const refText = `Réf : ${cleanText(order.reference)}`;
        const refWidth = helvetica.widthOfTextAtSize(refText, 11);
        page.drawText(refText, {
          x: PAGE_WIDTH - MARGIN - refWidth,
          y: PAGE_HEIGHT - 40,
          size: 11,
          font: helvetica,
          color: headerTextColor,
        });
      }
      const statusText = `Statut : ${cleanText(statusLabel(order.status))}`;
      const statusWidth = helveticaBold.widthOfTextAtSize(statusText, 12);
      page.drawText(statusText, {
        x: PAGE_WIDTH - MARGIN - statusWidth,
        y: PAGE_HEIGHT - 70,
        size: 12,
        font: helveticaBold,
        color: headerTextColor,
      });
      return PAGE_HEIGHT - headerHeight - 20;
    }

    page.drawText(`${cleanText(order.client_name || 'Bon')} (suite)`, {
      x: MARGIN, y: PAGE_HEIGHT - 32, size: 13, font: helveticaBold, color: headerTextColor,
    });
    return PAGE_HEIGHT - headerHeight - 15;
  };

  let y = drawHeader(true);

  // --- Bloc Détails client ----------------------------------------------------
  const detailsHeight = 130;
  page.drawRectangle({
    x: MARGIN, y: y - detailsHeight,
    width: CONTENT_WIDTH, height: detailsHeight,
    color: backgroundColor,
  });
  page.drawRectangle({
    x: MARGIN, y: y - detailsHeight, width: 4, height: detailsHeight, color: primaryColor,
  });

  let dy = y - 25;
  const label = (txt, val, lineSize = 11) => {
    page.drawText(`${txt} :`, {
      x: MARGIN + 15, y: dy, size: 10, font: helveticaBold, color: mutedColor,
    });
    page.drawText(cleanText(val || '—'), {
      x: MARGIN + 100, y: dy, size: lineSize, font: helvetica, color: textColor,
    });
    dy -= 18;
  };
  label('Client', order.client_name);
  label('Téléphone', order.client_phone);
  label('Adresse', order.address);
  if (order.scheduled_date) {
    label('Date prévue', new Date(order.scheduled_date).toLocaleDateString('fr-FR'));
  }
  if (order.completed_date) {
    label('Date de réalisation', new Date(order.completed_date).toLocaleDateString('fr-FR'));
  }
  y = y - detailsHeight - 15;

  // --- Description ------------------------------------------------------------
  if (order.description) {
    page.drawText("Description de l'intervention", {
      x: MARGIN, y, size: 12, font: helveticaBold, color: primaryColor,
    });
    y -= 18;
    // Wrap manuel basique (~110 chars)
    const wrap = (text, max) => {
      const words = text.split(/\s+/);
      const lines = [];
      let line = '';
      for (const w of words) {
        if ((line + ' ' + w).trim().length > max) {
          lines.push(line);
          line = w;
        } else {
          line = (line + ' ' + w).trim();
        }
      }
      if (line) lines.push(line);
      return lines;
    };
    for (const line of wrap(cleanText(order.description), 110)) {
      page.drawText(line, { x: MARGIN, y, size: 10, font: helvetica, color: textColor });
      y -= 14;
    }
    y -= 8;
  }

  // --- Cotes ------------------------------------------------------------------
  const measurements = Array.isArray(order.measurements) ? order.measurements : [];
  if (measurements.length > 0) {
    page.drawText('Cotes relevées', {
      x: MARGIN, y, size: 12, font: helveticaBold, color: primaryColor,
    });
    y -= 18;
    // En-têtes
    const cols = [
      { name: 'Repère', x: MARGIN, w: 200 },
      { name: 'Largeur (mm)', x: MARGIN + 200, w: 90 },
      { name: 'Hauteur (mm)', x: MARGIN + 290, w: 90 },
      { name: 'Ouvrant', x: MARGIN + 380, w: 130 },
      { name: 'Notes', x: MARGIN + 510, w: CONTENT_WIDTH - 510 },
    ];
    page.drawRectangle({
      x: MARGIN, y: y - 4, width: CONTENT_WIDTH, height: 18, color: primaryColor,
    });
    cols.forEach((c) => {
      page.drawText(c.name, {
        x: c.x + 4, y: y + 2, size: 9, font: helveticaBold, color: headerTextColor,
      });
    });
    y -= 18;

    for (let i = 0; i < measurements.length; i++) {
      const m = measurements[i];
      const rowH = 16;
      if (y - rowH < MARGIN + 30) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = drawHeader(false);
      }
      if (i % 2 === 0) {
        page.drawRectangle({
          x: MARGIN, y: y - 4, width: CONTENT_WIDTH, height: rowH, color: backgroundColor,
        });
      }
      const row = [
        cleanText(m.repere) || '—',
        cleanText(m.largeur) || '—',
        cleanText(m.hauteur) || '—',
        cleanText(m.ouvrant) || '—',
        cleanText(m.notes) || '—',
      ];
      // Boucle for…of plutôt que forEach pour éviter la fermeture sur `page`/`y`
      // dans une fonction déclarée à l'intérieur d'une boucle (no-loop-func).
      for (let idx = 0; idx < row.length; idx++) {
        page.drawText(row[idx].slice(0, 60), {
          x: cols[idx].x + 4, y: y + 2, size: 9, font: helvetica, color: textColor,
        });
      }
      y -= rowH;
    }
    y -= 8;
  }

  // --- Photos -----------------------------------------------------------------
  const photos = Array.isArray(order.photos) ? order.photos : [];
  if (photos.length > 0) {
    if (y - 30 < MARGIN + 30) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawHeader(false);
    }
    page.drawText('Photos', {
      x: MARGIN, y, size: 12, font: helveticaBold, color: primaryColor,
    });
    y -= 18;

    const PHOTO_HEIGHT = 160;
    const PHOTO_WIDTH = (CONTENT_WIDTH - 20) / 2;
    const photosPerRow = 2;
    let col = 0;

    for (const photo of photos) {
      try {
        const response = await fetch(photo.url);
        if (!response.ok) continue;
        const buf = await response.arrayBuffer();
        // pdf-lib only supports JPEG and PNG. Photos are uploaded as JPEG.
        const img = await pdfDoc.embedJpg(buf).catch(async () => pdfDoc.embedPng(buf));

        const dims = img.scale(1);
        const scale = Math.min(
          (PHOTO_WIDTH - 10) / dims.width,
          (PHOTO_HEIGHT - 25) / dims.height,
        );
        const sw = dims.width * scale;
        const sh = dims.height * scale;

        if (col === 0 && y - PHOTO_HEIGHT < MARGIN + 30) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          y = drawHeader(false);
        }

        const x = MARGIN + col * (PHOTO_WIDTH + 20) + ((PHOTO_WIDTH - sw) / 2);
        page.drawImage(img, { x, y: y - sh - 15, width: sw, height: sh });

        // Légende catégorie
        const cat = MENUISERIE_PHOTO_CATEGORIES[photo.category] || photo.category || '';
        if (cat) {
          page.drawText(cleanText(cat), {
            x: MARGIN + col * (PHOTO_WIDTH + 20) + 5,
            y: y - 5,
            size: 9,
            font: helveticaOblique,
            color: mutedColor,
          });
        }
      } catch (e) {
        console.warn('Photo PDF skip :', e);
      }

      col++;
      if (col >= photosPerRow) {
        col = 0;
        y -= PHOTO_HEIGHT + 10;
      }
    }
    if (col !== 0) y -= PHOTO_HEIGHT + 10;
    y -= 8;
  }

  // --- Notes ------------------------------------------------------------------
  if (order.notes) {
    if (y - 60 < MARGIN + 30) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawHeader(false);
    }
    page.drawText('Notes du menuisier', {
      x: MARGIN, y, size: 12, font: helveticaBold, color: primaryColor,
    });
    y -= 18;
    const lines = cleanText(order.notes).split('\n');
    for (const line of lines) {
      page.drawText(line.slice(0, 130), { x: MARGIN, y, size: 10, font: helvetica, color: textColor });
      y -= 14;
    }
  }

  // --- Pieds de page ----------------------------------------------------------
  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    p.drawText(`Page ${idx + 1}/${pages.length}`, {
      x: PAGE_WIDTH / 2 - 25, y: 20, size: 9, font: helvetica, color: primaryColor,
    });
    p.drawText(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, {
      x: MARGIN, y: 20, size: 9, font: helvetica, color: mutedColor,
    });
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  return { pdfBytes, blob, url };
}

// Helper pratique pour télécharger ou ouvrir le PDF
export function openOrDownloadPdf({ blob, url }, fileName) {
  const isMobile = /iphone|ipad|ipod|android|mobile|tablet/i.test(navigator.userAgent);
  if (isMobile) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    window.open(url, '_blank');
  }
  // Le caller peut révoquer l'URL plus tard via URL.revokeObjectURL(url).
}
