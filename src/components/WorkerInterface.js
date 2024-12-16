import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Download, Eye, XCircle, FileText, Mail, CheckCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DBService, compressImage, STORES } from '../services/dbService';
import { Modal } from './Modal';
import { supabase } from '../services/supabase';
import EmailPDFManager from './EmailPDFManager';

function WorkerInterface() {
  const [sites, setSites] = useState([]);
  const [trades, setTrades] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [modalState, setModalState] = useState({ type: null, data: null });
  const [photo, setPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

   // Function to detect iOS
   const isIOS = () => {
    return [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ].includes(navigator.platform)
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
  };

  const isMobileDevice = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android|mobile|tablet/.test(userAgent);
    const isStandalone = window.navigator.standalone;
    const isInWebAppiOS = (window.navigator.standalone === true);
    const isInWebAppChrome = (window.matchMedia('(display-mode: standalone)').matches);
    
    return isMobile || isStandalone || isInWebAppiOS || isInWebAppChrome;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sitesData, tradesData] = await Promise.all([
          DBService.getAll(STORES.SITES),
          DBService.getAll(STORES.TRADES)
        ]);
        setSites(sitesData || []);
        setTrades(tradesData || []);
      } catch (error) {
        console.error('Erreur de chargement:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handlePhotoCapture = async (siteId, taskId, photoFile) => {
    if (!photoFile || !(photoFile instanceof Blob)) {
      alert('Veuillez prendre une photo valide');
      return;
    }

    try {
      setIsLoading(true);
      const photoId = `${Date.now()}-${Date.now() + 4880}`;
      const fileName = `${photoId}.jpg`;

      let fileToUpload = photoFile;
      if (photoFile.type !== 'image/jpeg') {
        const img = new Image();
        const canvas = document.createElement('canvas');
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = URL.createObjectURL(photoFile);
        });

        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        fileToUpload = await new Promise(resolve => {
          canvas.toBlob(resolve, 'image/jpeg', 0.9);
        });
      }

      const { data, error } = await supabase.storage
        .from('photos')
        .upload(`public/photos/${fileName}`, fileToUpload, {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '3600'
        });

      if (error) {
        console.error('Erreur upload Supabase:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(`public/photos/${fileName}`);

      // Mettre à jour l'état local immédiatement
      const updatedSites = sites.map(site => {
        if (site.id === siteId) {
          const updatedSite = {
            ...site,
            tasks: site.tasks.map(task => {
              if (task.id === taskId) {
                return {
                  ...task,
                  completed: true,
                  photoId: photoId,
                  photoUrl: publicUrl,
                  completedAt: new Date().toISOString(),
                  completedBy: 'worker_id'
                };
              }
              return task;
            })
          };
          // Mettre à jour selectedSite si c'est le site actuel
          if (selectedSite && selectedSite.id === siteId) {
            setSelectedSite(updatedSite);
          }
          return updatedSite;
        }
        return site;
      });

      const { error: siteError } = await supabase
        .from('sites')
        .update({ tasks: updatedSites.find(s => s.id === siteId).tasks })
        .eq('id', siteId);
      
      if (siteError) {
        console.error('Erreur mise à jour site:', siteError);
        throw siteError;
      }

      setSites(updatedSites);
      setModalState({ type: null });
    } catch (error) {
      console.error('Erreur lors de la capture:', error);
      alert(`Erreur lors de l'envoi de la photo: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const previewPhoto = async (file) => {
    if (!file || !(file instanceof Blob)) {
      throw new Error('Fichier photo invalide');
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
      reader.readAsDataURL(file);
    });
  };

  const handleTaskCompletion = async (siteId, taskId, photoFile) => {
    try {
      if (!photoFile || !(photoFile instanceof Blob)) {
        throw new Error('Une photo valide est requise');
      }

      const previewUrl = await previewPhoto(photoFile);
      setModalState({ 
        type: 'confirm-completion', 
        data: { 
          siteId, 
          taskId, 
          photoFile,
          previewUrl 
        } 
      });
    } catch (error) {
      console.error('Erreur:', error);
      alert(error.message);
    }
  };

  // Nettoyer l'URL du PDF quand le composant est démonté
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const generatePDF = useCallback(async (site) => {
    const margin = 30; // Réduction des marges générales
    if (!site || pdfGenerating) return;
  
    try {
      setPdfGenerating(true);
  
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([842, 1191]); // A4

      // Fonction utilitaire pour nettoyer le texte
      const cleanText = (text) => {
        if (!text) return '';
        // Remplacer les caractères problématiques par leurs équivalents compatibles
        return text
          .replace(/[≥]/g, '>=')
          .replace(/[≤]/g, '<=')
          .replace(/[—]/g, '-')
          .replace(/[""]/g, '"')
          .replace(/['']/g, "'")
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '') // Enlève les accents
          .replace(/[^\x00-\x7F]/g, ''); // Garde uniquement les caractères ASCII
      };
      
      // Incorporation des polices
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

      // Constantes de design
      const margin = 30; // Modifié
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const contentWidth = pageWidth - (2 * margin);
      
      // Fonction sécurisée pour dessiner du texte
      const drawSafeText = (text, options) => {
        try {
          const cleanedText = cleanText(text);
          page.drawText(cleanedText, options);
        } catch (error) {
          console.warn('Erreur lors du dessin du texte:', text, error);
          // Tenter de dessiner caractère par caractère en cas d'erreur
          try {
            const chars = cleanText(text).split('');
            let xOffset = 0;
            chars.forEach(char => {
              try {
                page.drawText(char, {
                  ...options,
                  x: options.x + xOffset
                });
                xOffset += options.size * 0.6; // Estimation approximative de la largeur
              } catch (charError) {
                console.warn('Impossible de dessiner le caractère:', char);
              }
            });
          } catch (fallbackError) {
            console.error('Échec du fallback texte:', fallbackError);
          }
        }
      };

      // Fonction pour créer une nouvelle page
      const createNewPage = () => {
        page = pdfDoc.addPage([842, 1191]);
        drawRect(0, pageHeight - 100, pageWidth, 100, primaryColor);
        drawSafeText(`${cleanText(site.name)} (suite)`, {
          x: margin,
          y: pageHeight - 60,
          size: 24,
          font: helveticaBold,
          color: headerTextColor,
        });
        return pageHeight - 150;
      };

      // Couleurs
      const primaryColor = rgb(0.12, 0.29, 0.49);
      const secondaryColor = rgb(0.97, 0.97, 0.97);
      const accentColor = rgb(0.2, 0.5, 0.8);
      const textColor = rgb(0.1, 0.1, 0.1);
      const headerTextColor = rgb(1, 1, 1);

      // Fonction pour dessiner des rectangles
      const drawRect = (x, y, width, height, color) => {
        page.drawRectangle({
          x,
          y,
          width,
          height,
          color: color,
        });
      };

      // En-tête avec informations du chantier
      drawRect(0, pageHeight - 140, pageWidth, 140, primaryColor);
      
      // Titre principal
      drawSafeText("RAPPORT D'INSPECTION", {
        x: margin,
        y: pageHeight - 40,
        size: 24,
        font: helveticaBold,
        color: headerTextColor,
      });

      // Informations du site
      drawSafeText(`Chantier : ${cleanText(site.name)}`, {
        x: margin,
        y: pageHeight - 70,
        size: 16,
        font: helveticaBold,
        color: headerTextColor,
      });

      drawSafeText(`Adresse : ${cleanText(site.address)}`, {
        x: margin,
        y: pageHeight - 90,
        size: 12,
        font: helvetica,
        color: headerTextColor,
      });

      // Date du rapport
      const currentDate = new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      drawSafeText(`Genere le ${cleanText(currentDate)}`, {
        x: margin,
        y: pageHeight - 110,
        size: 10,
        font: helveticaOblique,
        color: headerTextColor,
      });

      let yPosition = pageHeight - 180;

      // Fonction pour dessiner une tâche
      const drawTask = async (task, yPos) => {
        // Réduire considérablement la hauteur des tâches
        const taskHeight = task.photoUrl ? 160 : 60; // Réduit pour plus de compacité
        
        if (yPos - taskHeight < 80) {
          yPos = createNewPage();
        }
      
        // Réduire la taille du rectangle de fond
        drawRect(margin - 3, yPos, contentWidth + 6, -taskHeight, secondaryColor);
        drawRect(margin - 3, yPos, 2, -taskHeight, accentColor); // Barre plus fine
      
        // Mise en page plus compacte pour le texte
        let currentY = yPos - 15;
      
        // Afficher la description et le corps de métier sur la même ligne
        const trade = task.tradeId ? trades.find(t => t.id.toString() === task.tradeId) : null;
        const description = task.description + (trade ? ` (${trade.name})` : '');
        
        drawSafeText(cleanText(description), {
          x: margin + 10,
          y: currentY,
          size: 11,
          font: helveticaBold,
          color: textColor,
        });
        currentY -= 15;
      
        // Pièce et date sur la même ligne
        const taskDate = task.completedAt 
          ? new Date(task.completedAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })
          : "Non complete";
      
        const locationAndDate = `${task.room || "Non specifiee"} - Réalisé le ${taskDate}`;
        drawSafeText(cleanText(locationAndDate), {
          x: margin + 10,
          y: currentY,
          size: 9,
          font: helvetica,
          color: textColor,
        });

        // Ajouter le corps de métier si disponible
  if (task.tradeId) {
    const trade = trades.find(t => t.id.toString() === task.tradeId);
    if (trade) {
      drawSafeText(`Corps de metier : ${cleanText(trade.name)}`, {
        x: margin + 20,
        y: yPos - 100,
        size: 12,
        font: helvetica,
        color: textColor,
      });
    }
  }

  // Traitement de l'image
  if (task.photoUrl) {
    try {
      const response = await fetch(task.photoUrl);
      const imageData = await response.arrayBuffer();
      const image = await pdfDoc.embedJpg(imageData);
      
      const imgDims = image.scale(1);
      const maxWidth = (contentWidth - 40) / 2; // Marges réduites
      const maxHeight = 100; // Hauteur maximale réduite
      
      const scale = Math.min(
        maxWidth / imgDims.width,
        maxHeight / imgDims.height
      );
      
      const scaledWidth = Math.floor(imgDims.width * scale);
      const scaledHeight = Math.floor(imgDims.height * scale);
      const xOffset = margin + Math.floor((contentWidth - scaledWidth) / 2);

      page.drawImage(image, {
        x: xOffset,
        y: currentY - scaledHeight - 5, // Espacement réduit
        width: scaledWidth,
        height: scaledHeight,
      });
    } catch (error) {
      console.warn('Erreur lors du traitement de l\'image:', error);
    }
  }

  return yPos - taskHeight - 10;
};



      // Afficher toutes les tâches
      for (const task of site.tasks) {
        yPosition = await drawTask(task, yPosition);
      }

      // Pied de page
      pdfDoc.getPages().forEach((p, index) => {
        drawSafeText(`Page ${index + 1} sur ${pdfDoc.getPageCount()}`, {
          x: pageWidth / 2 - 40,
          y: margin / 2,
          size: 10,
          font: helvetica,
          color: primaryColor,
        });
      });

      // Génération et ouverture du PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      
      const newUrl = URL.createObjectURL(blob);
      setPdfUrl(newUrl);
      setPdfBlob(blob);
      window.open(newUrl, '_blank');

      // Handle differently for iOS
      if (isIOS()) {
        setShowDownloadModal(true);
      } else {
        window.open(newUrl, '_blank');
      }

       // Gestion différente selon le type d'appareil
       if (isMobileDevice()) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        const newUrl = URL.createObjectURL(blob);
        setPdfUrl(newUrl);
        setPdfBlob(blob);
        setShowDownloadModal(true);
      } else {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const newUrl = URL.createObjectURL(blob);
        window.open(newUrl, '_blank');
      }
      
      // Retourner les bytes du PDF pour pouvoir les réutiliser
      return pdfBytes;

    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Une erreur est survenue lors de la génération du PDF.');
    } finally {
      setPdfGenerating(false);
    }
}, [pdfUrl, pdfGenerating]);

// Fonction améliorée pour gérer le téléchargement
const handlePDFDownload = () => {
  if (!pdfBlob) return;

  try {
    const fileName = `rapport-${selectedSite.name}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    if (navigator.userAgent.match(/android/i)) {
      // Pour Android, on utilise l'API de partage si disponible
      if (navigator.share) {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        navigator.share({
          files: [file],
          title: 'Rapport PDF',
          text: 'Télécharger le rapport PDF'
        }).catch(console.error);
      } else {
        // Fallback pour les anciens appareils Android
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = fileName;
        link.click();
      }
    } else {
      // Pour iOS et autres appareils
      const link = document.createElement('a');
      link.href = URL.createObjectURL(pdfBlob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    setShowDownloadModal(false);
  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
    alert('Une erreur est survenue lors du téléchargement. Veuillez réessayer.');
  }
};

const sendReportByEmail = async (site, email) => {
  try {
    setIsLoading(true);
    setPdfGenerating(true);
    
    // Générer le PDF
    const pdfBytes = await generatePDF(site);
    if (!pdfBytes) {
      throw new Error('Erreur lors de la génération du PDF');
    }
    
    return pdfBytes;

  } catch (error) {
    console.error('Erreur lors de la génération du rapport:', error);
    throw error;
  } finally {
    setIsLoading(false);
    setPdfGenerating(false);
  }
};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Vue liste des chantiers
  if (!selectedSite) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Mes chantiers</h1>
        <div className="grid gap-4">
          {sites.map(site => {
            const completedTasks = site.tasks.filter(task => task.completed).length;
            const totalTasks = site.tasks.length;
            const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

            return (
              <div
                key={site.id}
                onClick={() => setSelectedSite(site)}
                className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold mb-2">{site.name}</h2>
                    <p className="text-gray-600 mb-2">{site.address}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full w-48">
                        <div
                          className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 whitespace-nowrap">
                        {completedTasks}/{totalTasks} tâches
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="text-gray-400 ml-4" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Vue détaillée du chantier
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setSelectedSite(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
          Retour aux chantiers
        </button>
        <h1 className="text-2xl font-bold">{selectedSite.name}</h1>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600 mb-4">{selectedSite.address}</p>
        
        <div className="space-y-6">
          {Object.entries(
            selectedSite.tasks.reduce((acc, task) => {
              const room = task.room || 'Non assigné';
              if (!acc[room]) acc[room] = [];
              acc[room].push(task);
              return acc;
            }, {})
          ).map(([room, tasks]) => (
            <div key={room} className="border-t pt-4 first:border-t-0 first:pt-0">
              <h3 className="text-lg font-medium mb-3 text-gray-700">{room}</h3>
              <div className="space-y-4">
                {tasks.map(task => {
                  const trade = trades.find(t => t.id.toString() === task.tradeId);
                  return (
                    <div key={task.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium">{task.description}</p>
                              <p className="text-sm text-gray-500">{trade?.name}</p>
                            </div>
                            {!task.completed && (
                              <label className="relative overflow-hidden flex items-center gap-2 bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 cursor-pointer">
                                <Camera className="h-4 w-4" />
                                <span>Valider</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleTaskCompletion(selectedSite.id, task.id, file);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                          {task.completedAt && (
                            <p className="text-sm text-gray-500">
                              Terminé le {new Date(task.completedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      {task.photoUrl && (
                        <div className="mt-3">
                          <div className="relative group aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
                            <img
                              src={task.photoUrl}
                              alt="Preuve de réalisation"
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setModalState({
                                type: 'view-photo',
                                data: { photoUrl: task.photoUrl }
                              })}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                              <Eye className="text-white opacity-0 group-hover:opacity-100 h-8 w-8" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {selectedSite?.tasks.length > 0 && selectedSite.tasks.every(task => task.completed) && (
  <div className="flex justify-end mt-6 gap-4">
    <button
      onClick={() => generatePDF(selectedSite)}
      disabled={pdfGenerating}
      className={`flex items-center gap-2 ${
        pdfGenerating ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
      } text-white px-4 py-2 rounded-lg transition-colors duration-200`}
    >
      {pdfGenerating ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>Génération en cours...</span>
        </>
      ) : (
        <>
          <FileText className="h-4 w-4" />
          <span>Générer PDF</span>
        </>
      )}
    </button>
    <button
      onClick={() => setModalState({
        type: 'send-report',
        data: { site: selectedSite }
      })}
      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
    >
      <Mail className="h-4 w-4" />
      Envoyer rapport
    </button>
  </div>
)}
      </div>

      {/* Modales */}
      {showDownloadModal && (
    <Modal
      title="Télécharger le rapport PDF"
      onClose={() => setShowDownloadModal(false)}
    >
      <div className="p-4 space-y-4">
        <p className="text-gray-600">
          Le PDF a été généré avec succès. Sur certains appareils mobiles, le PDF pourrait s'ouvrir directement dans votre application par défaut.
        </p>
        <div className="flex flex-col space-y-3">
          <button
            onClick={handlePDFDownload}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full"
          >
            <Download className="h-5 w-5" />
            Télécharger le PDF
          </button>
          <button
            onClick={() => setShowDownloadModal(false)}
            className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100 w-full"
          >
            Annuler
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Si le téléchargement ne démarre pas automatiquement, vérifiez les paramètres de votre navigateur concernant les téléchargements.
        </p>
      </div>
    </Modal>
  )}

      {modalState.type === 'view-photo' && (
        <Modal
          title="Photo de la tâche"
          onClose={() => setModalState({ type: null })}
        >
          <img
            src={modalState.data.photoUrl}
            alt="Preuve de réalisation"
            className="w-full rounded-lg"
          />
        </Modal>
      )}

      {modalState.type === 'confirm-completion' && (
        <Modal
          title="Confirmer la réalisation"
          onClose={() => setModalState({ type: null })}
        >
          <div className="space-y-4">
            <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
              <img
                src={modalState.data.previewUrl}
                alt="Aperçu"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex justify-between items-center">
            <button
                onClick={() => setModalState({ type: null })}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <XCircle className="h-5 w-5" />
                Annuler
              </button>
              <button
                onClick={() => handlePhotoCapture(
                  modalState.data.siteId,
                  modalState.data.taskId,
                  modalState.data.photoFile
                )}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="h-5 w-5" />
                Confirmer
              </button>
            </div>
          </div>
        </Modal>
      )}

{modalState.type === 'send-report' && (
  <Modal
    title="Envoyer le rapport"
    onClose={() => setModalState({ type: null })}
  >
    <div className="space-y-6">
      <button 
        onClick={() => {
          if (pdfBlob) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(pdfBlob);
            link.download = `rapport-${modalState.data.site.name}-${new Date().toISOString().slice(0,10)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
          } else {
            alert('Erreur : Le PDF n\'a pas encore été généré');
          }
        }}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200"
      >
        <Download className="h-5 w-5" />
        Télécharger le PDF
      </button>
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">ou</span>
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-700">
          Envoyer par email
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            id="email"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="exemple@email.com"
          />
          <EmailPDFManager
            onSend={() => sendReportByEmail(modalState.data.site, document.getElementById('email').value)}
            isGenerating={pdfGenerating}
          />
        </div>
      </div>

      <p className="text-sm text-gray-500 mt-2">
        Note : Le PDF sera téléchargé automatiquement pour pouvoir être joint à votre email.
      </p>
    </div>
  </Modal>
)}
    </div>
  );
}

export default WorkerInterface;