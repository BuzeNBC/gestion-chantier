// components/CompletedSites.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { LineChart, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Bar } from 'recharts';
import { Download, Loader2, FileText } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const CompletedSites = () => {
  const [completedSites, setCompletedSites] = useState([]);
  const [stats, setStats] = useState({
    totalSites: 0,
    avgCompletionTime: 0,
    totalTasks: 0,
  });
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);

  useEffect(() => {
    const fetchCompletedSites = async () => {
      const { data, error } = await supabase
        .from('sites')
        .select(`
          *,
          profiles:worker_id (Name)
        `)
        .eq('status', 'completed');

      if (error) throw error;

      setCompletedSites(data);
      calculateStats(data);
    };

    fetchCompletedSites();
  }, []);

  const calculateStats = (sites) => {
    const totalTasks = sites.reduce((acc, site) => acc + (site.tasks?.length || 0), 0);
    const completionTimes = sites.map(site => {
      const start = new Date(site.startDate);
      const end = new Date(site.completeddate || Date.now());
      return Math.floor((end - start) / (1000 * 60 * 60 * 24));
    });
    const avgTime = completionTimes.length ? 
      Math.round(completionTimes.reduce((a, b) => a + b) / completionTimes.length) : 0;

    setStats({
      totalSites: sites.length,
      avgCompletionTime: avgTime,
      totalTasks
    });
  };

  const generatePDF = async (site) => {
    if (!site || pdfGenerating) return;
  
    try {
      setPdfGenerating(true);
      const pdfDoc = await PDFDocument.create();
      
      const PAGE_WIDTH = 842;
      const PAGE_HEIGHT = 1191;
      const MARGIN = 40;
      const CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN);
      
      let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let yPosition = PAGE_HEIGHT - MARGIN;
  
      // Polices et couleurs
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const primaryColor = rgb(0.12, 0.29, 0.49);
      const textColor = rgb(0.1, 0.1, 0.1);
      const headerTextColor = rgb(1, 1, 1);
  
      // En-tête du rapport
      page.drawRectangle({
        x: 0,
        y: PAGE_HEIGHT - 100,
        width: PAGE_WIDTH,
        height: 100,
        color: primaryColor,
      });

      page.drawText("RAPPORT DE FIN DE CHANTIER", {
        x: MARGIN,
        y: PAGE_HEIGHT - 50,
        size: 24,
        font: helveticaBold,
        color: headerTextColor,
      });

      yPosition = PAGE_HEIGHT - 150;

      // Informations du chantier
      page.drawText(`Chantier: ${site.name}`, {
        x: MARGIN,
        y: yPosition,
        size: 16,
        font: helveticaBold,
        color: textColor,
      });

      yPosition -= 30;

      page.drawText(`Adresse: ${site.address}`, {
        x: MARGIN,
        y: yPosition,
        size: 12,
        font: helvetica,
        color: textColor,
      });

      yPosition -= 25;

      const startDate = new Date(site.startDate).toLocaleDateString('fr-FR');
      const completionDate = new Date(site.completeddate).toLocaleDateString('fr-FR');
      
      page.drawText(`Date de début: ${startDate}`, {
        x: MARGIN,
        y: yPosition,
        size: 12,
        font: helvetica,
        color: textColor,
      });

      yPosition -= 20;

      page.drawText(`Date de fin: ${completionDate}`, {
        x: MARGIN,
        y: yPosition,
        size: 12,
        font: helvetica,
        color: textColor,
      });

      yPosition -= 40;

      // Statistiques du chantier
      const totalTasks = site.tasks?.length || 0;
      const completedTasks = site.tasks?.filter(task => task.completed)?.length || 0;
      
      page.drawText("Résumé du chantier", {
        x: MARGIN,
        y: yPosition,
        size: 14,
        font: helveticaBold,
        color: primaryColor,
      });

      yPosition -= 25;

      page.drawText(`Total des tâches: ${totalTasks}`, {
        x: MARGIN,
        y: yPosition,
        size: 12,
        font: helvetica,
        color: textColor,
      });

      // Configuration des images comme dans WorkerInterface
      const PHOTO_HEIGHT = 100;
      const PHOTO_WIDTH = (CONTENT_WIDTH - 40) / 2;
      const TASK_PADDING = 15;
      
      // Photos et tâches
      if (site.tasks && site.tasks.length > 0) {
        yPosition -= 40;
        
        page.drawText("Détail des tâches réalisées", {
          x: MARGIN,
          y: yPosition,
          size: 14,
          font: helveticaBold,
          color: primaryColor,
        });

        yPosition -= 30;

        for (const task of site.tasks) {
          const hasPhotos = task.photos && task.photos.length > 0;
          const minHeight = 60;
          const photoSectionHeight = hasPhotos ? PHOTO_HEIGHT + 10 : 0;
          const taskHeight = Math.max(minHeight, photoSectionHeight + 50);

          if (yPosition - taskHeight < MARGIN) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            yPosition = PAGE_HEIGHT - MARGIN;
          }

          // Fond de la tâche
          page.drawRectangle({
            x: MARGIN,
            y: yPosition,
            width: CONTENT_WIDTH,
            height: -taskHeight,
            color: rgb(0.98, 0.98, 0.98),
          });

          // Barre latérale
          page.drawRectangle({
            x: MARGIN,
            y: yPosition,
            width: 4,
            height: -taskHeight,
            color: primaryColor,
          });

          let currentY = yPosition - 20;

          // Description de la tâche
          page.drawText(task.description, {
            x: MARGIN + TASK_PADDING,
            y: currentY,
            size: 12,
            font: helveticaBold,
            color: textColor,
          });

          currentY -= 18;

          if (task.completedAt) {
            const completeddate = new Date(task.completedAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });
            const dateText = `Réalisé le ${completeddate}`;
            const dateWidth = helvetica.widthOfTextAtSize(dateText, 10);
            
            page.drawText(dateText, {
              x: MARGIN + CONTENT_WIDTH - dateWidth - TASK_PADDING,
              y: currentY,
              size: 10,
              font: helvetica,
              color: textColor,
            });
          }

          // Photos
          if (hasPhotos) {
            currentY -= 15;
            let photoX = MARGIN + TASK_PADDING;

            for (let i = 0; i < Math.min(2, task.photos.length); i++) {
              try {
                const photo = task.photos[i];
                const response = await fetch(photo.url);
                const imageData = await response.arrayBuffer();
                const image = await pdfDoc.embedJpg(imageData);

                const imgDims = image.scale(1);
                const scaleFactor = Math.min(
                  (PHOTO_WIDTH - 20) / imgDims.width,
                  (PHOTO_HEIGHT - 10) / imgDims.height
                );

                const scaledWidth = imgDims.width * scaleFactor;
                const scaledHeight = imgDims.height * scaleFactor;

                const xOffset = (PHOTO_WIDTH - scaledWidth) / 2;
                const yOffset = (PHOTO_HEIGHT - scaledHeight) / 2;

                page.drawImage(image, {
                  x: photoX + xOffset,
                  y: currentY - PHOTO_HEIGHT + yOffset,
                  width: scaledWidth,
                  height: scaledHeight,
                });

                photoX += PHOTO_WIDTH + 20;
              } catch (error) {
                console.warn('Erreur lors du traitement de l\'image:', error);
              }
            }
          }

          yPosition -= taskHeight + 10;
      }
    }
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setPdfUrl(url);
      setPdfBlob(blob);
      
      // Télécharger automatiquement
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport-${site.name.toLowerCase().replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Une erreur est survenue lors de la génération du PDF.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const chartData = completedSites.map(site => ({
    name: site.name.substring(0, 15),
    duree: Math.floor((new Date(site.completeddate || Date.now()) - new Date(site.startDate)) / (1000 * 60 * 60 * 24))
  }));

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-4xl font-bold text-gray-800">Chantiers Terminés</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Total Chantiers</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalSites}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Temps Moyen (jours)</h3>
          <p className="text-3xl font-bold text-green-600">{stats.avgCompletionTime}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Total Tâches</h3>
          <p className="text-3xl font-bold text-purple-600">{stats.totalTasks}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Durée des Chantiers</h3>
        <div className="h-96">
          <BarChart width={800} height={300} data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="duree" fill="#3B82F6" name="Durée (jours)" />
          </BarChart>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
            <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adresse</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ouvrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durée (jours)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tâches</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {completedSites.map(site => (
                <tr key={site.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{site.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{site.address}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{site.profiles?.Name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {Math.floor((new Date(site.completeddate || Date.now()) - new Date(site.startDate)) / (1000 * 60 * 60 * 24))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {site.tasks?.length || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => generatePDF(site)}
                      disabled={pdfGenerating}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {pdfGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span>Génération...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          <span>Rapport</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CompletedSites;