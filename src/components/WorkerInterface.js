import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Download, Eye, XCircle, FileText, Mail, CheckCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DBService, compressImage, STORES } from '../services/dbService';
import { Modal } from './Modal';
import { supabase } from '../services/supabase';
import EmailPDFManager from './EmailPDFManager';
import { useAuth } from '../contexts/AuthContext';

function WorkerInterface({ isAdminInWorkerMode = false }) {
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
  const { user } = useAuth();

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

// Au début du composant, ajoutez un state pour le rôle
const [isAdmin, setIsAdmin] = useState(false);

// Modifiez le useEffect comme suit
useEffect(() => {
  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Récupérer l'utilisateur actuel et son profil
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

      // Charger tous les sites sans filtre de worker_id
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select(`
          *,
          profiles:worker_id (
            id,
            Name
          )
        `);

      if (sitesError) {
        console.error('Erreur sites:', sitesError);
        throw sitesError;
      }

      console.log('Sites chargés:', sitesData);
      setSites(sitesData || []);

    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    loadData();
  }
}, [user, isAdminInWorkerMode]);

// Fonction pour vérifier si l'utilisateur peut supprimer une photo
const canDeletePhoto = (task) => {
  // L'admin peut toujours supprimer
  if (isAdminInWorkerMode) {
    return true;
  }
  
  // L'ouvrier peut supprimer uniquement s'il est celui qui a complété la tâche
  return task.completedBy === user.id;
};

// Fonction modifiée pour la suppression des photos
// Modifiez la fonction handlePhotoDelete
const handlePhotoDelete = async (siteId, taskId, photoId) => {
  try {
    setIsLoading(true);
    
    // Trouvez la tâche et la photo
    const task = selectedSite.tasks.find(t => t.id === taskId);
    const photo = task.photos.find(p => p.id === photoId);
    
    if (!photo) {
      throw new Error('Photo non trouvée');
    }

    // Supprimer la photo de Supabase Storage
    const fileName = photo.url.split('/').pop();
    const { error: storageError } = await supabase.storage
      .from('photos')
      .remove([`public/photos/${fileName}`]);

    if (storageError) {
      throw storageError;
    }

    // Mettre à jour les sites en mémoire
    const updatedSites = sites.map(site => {
      if (site.id === siteId) {
        const updatedSite = {
          ...site,
          tasks: site.tasks.map(task => {
            if (task.id === taskId) {
              const updatedPhotos = task.photos.filter(p => p.id !== photoId);
              // Si c'était la dernière photo, on réinitialise la tâche
              const isLastPhoto = updatedPhotos.length === 0;
              return {
                ...task,
                photos: updatedPhotos,
                // Si c'était la dernière photo, on met completed à false
                completed: isLastPhoto ? false : task.completed,
                // Si c'était la dernière photo, on retire completedAt et completedBy
                completedAt: isLastPhoto ? null : task.completedAt,
                completedBy: isLastPhoto ? null : task.completedBy
              };
            }
            return task;
          })
        };
        if (selectedSite && selectedSite.id === siteId) {
          setSelectedSite(updatedSite);
        }
        return updatedSite;
      }
      return site;
    });

    // Mettre à jour la base de données
    const { error: updateError } = await supabase
      .from('sites')
      .update({ tasks: updatedSites.find(s => s.id === siteId).tasks })
      .eq('id', siteId);

    if (updateError) {
      throw updateError;
    }

    setSites(updatedSites);
  } catch (error) {
    console.error('Erreur lors de la suppression de la photo:', error);
    alert('Erreur lors de la suppression de la photo');
  } finally {
    setIsLoading(false);
  }
};

// Fonction modifiée pour l'ajout de photo
const handleFirstPhotoAndComplete = async (siteId, taskId, photoFile) => {
  if (!photoFile || !(photoFile instanceof Blob)) {
    alert('Veuillez prendre une photo valide');
    return;
  }

  try {
    setIsLoading(true);
    const photoId = `${Date.now()}-${Date.now() + 4880}`;
    const fileName = `${photoId}.jpg`;

    // Compression et upload de la photo
    let fileToUpload = photoFile;
    if (photoFile.type !== 'image/jpeg') {
      // ... code de compression existant ...
    }

    const { data, error } = await supabase.storage
      .from('photos')
      .upload(`public/photos/${fileName}`, fileToUpload, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600'
      });

    if (error) {
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(`public/photos/${fileName}`);

    // Mettre à jour les sites avec l'ID de l'utilisateur qui complète la tâche
    const updatedSites = sites.map(site => {
      if (site.id === siteId) {
        const updatedSite = {
          ...site,
          tasks: site.tasks.map(task => {
            if (task.id === taskId) {
              const photos = task.photos || [];
              return {
                ...task,
                completed: true,
                photos: [...photos, {
                  id: photoId,
                  url: publicUrl,
                  timestamp: new Date().toISOString()
                }],
                completedAt: new Date().toISOString(),
                completedBy: user.id // Stocker l'ID de l'utilisateur qui complète la tâche
              };
            }
            return task;
          })
        };
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
    if (!site || pdfGenerating) return;
  
    try {
      setPdfGenerating(true);
      const pdfDoc = await PDFDocument.create();
      
      // Réduction des dimensions
      const PAGE_WIDTH = 842;
      const PAGE_HEIGHT = 1191;
      const MARGIN = 40;
      const CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN);
      
      // Configuration des images plus compacte
      const PHOTO_HEIGHT = 100;
      const PHOTO_WIDTH = (CONTENT_WIDTH - 40) / 2;
      const TASK_PADDING = 15;
      
      let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let yPosition = PAGE_HEIGHT - MARGIN;
  
      // Polices et couleurs
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  
      const primaryColor = rgb(0.12, 0.29, 0.49);
      const textColor = rgb(0.1, 0.1, 0.1);
      const headerTextColor = rgb(1, 1, 1);
      const backgroundColor = rgb(0.98, 0.98, 0.98);
  
      const cleanText = (text) => {
        if (!text) return '';
  
        try {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder('utf-8');
          let cleanedText = decoder.decode(encoder.encode(text));
  
          // Remplacer les caractères spéciaux
          cleanedText = cleanedText
            .replace(/[≥]/g, '>=')
            .replace(/[≤]/g, '<=')
            .replace(/[—–]/g, '-')
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'")
            .replace(/[…]/g, '...');
  
          return cleanedText;
        } catch (error) {
          return text;
        }
      };
  
      const drawHeader = (isFirstPage = false) => {
        const headerHeight = isFirstPage ? 100 : 60;
        
        page.drawRectangle({
          x: 0,
          y: PAGE_HEIGHT - headerHeight,
          width: PAGE_WIDTH,
          height: headerHeight,
          color: primaryColor,
        });
  
        if (isFirstPage) {
          page.drawText("RAPPORT D'INSPECTION", {
            x: MARGIN,
            y: PAGE_HEIGHT - 35,
            size: 22,
            font: helveticaBold,
            color: headerTextColor,
          });
  
          page.drawText(`Chantier: ${cleanText(site.name)}`, {
            x: MARGIN,
            y: PAGE_HEIGHT - 65,
            size: 14,
            font: helveticaBold,
            color: headerTextColor,
          });
  
          page.drawText(`Adresse: ${cleanText(site.address)}`, {
            x: MARGIN,
            y: PAGE_HEIGHT - 85,
            size: 12,
            font: helvetica,
            color: headerTextColor,
          });
  
          return PAGE_HEIGHT - headerHeight - 20;
        } else {
          page.drawText(`${cleanText(site.name)} (suite)`, {
            x: MARGIN,
            y: PAGE_HEIGHT - 40,
            size: 14,
            font: helveticaBold,
            color: headerTextColor,
          });
          return PAGE_HEIGHT - headerHeight - 15;
        }
      };
  
      yPosition = drawHeader(true);
  
      const drawTask = async (task, startY) => {
        const hasPhotos = task.photos && task.photos.length > 0;
        const minHeight = 60;
        const photoSectionHeight = hasPhotos ? PHOTO_HEIGHT + 10 : 0;
        const taskHeight = Math.max(minHeight, photoSectionHeight + 50);
  
        if (startY - taskHeight < MARGIN) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          startY = drawHeader(false);
        }
  
        // Fond de la tâche
        page.drawRectangle({
          x: MARGIN,
          y: startY,
          width: CONTENT_WIDTH,
          height: -taskHeight,
          color: backgroundColor,
        });
  
        // Barre latérale
        page.drawRectangle({
          x: MARGIN,
          y: startY,
          width: 4,
          height: -taskHeight,
          color: primaryColor,
        });
  
        let currentY = startY - 20;
  
        // Description et infos
        const trade = trades.find(t => t.id.toString() === task.tradeId);
        const tradeText = trade ? ` - ${trade.name}` : '';
        
        // Description de la tâche
        page.drawText(cleanText(task.description), {
          x: MARGIN + TASK_PADDING,
          y: currentY,
          size: 12,
          font: helveticaBold,
          color: textColor,
        });
  
        currentY -= 18;
  
        // Localisation et métier
        const locationText = `${task.room || 'Non spécifié'}${tradeText}`;
        page.drawText(cleanText(locationText), {
          x: MARGIN + TASK_PADDING,
          y: currentY,
          size: 10,
          font: helvetica,
          color: textColor,
        });
  
        // Date alignée à droite
        if (task.completedAt) {
          const completionDate = new Date(task.completedAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
          const dateText = `Réalisé le ${completionDate}`;
          const dateWidth = helveticaOblique.widthOfTextAtSize(dateText, 10);
          
          page.drawText(cleanText(dateText), {
            x: MARGIN + CONTENT_WIDTH - dateWidth - TASK_PADDING,
            y: currentY,
            size: 10,
            font: helveticaOblique,
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
  
        return startY - taskHeight - 10;
      };
  
      // Dessiner les tâches
      for (const task of site.tasks) {
        yPosition = await drawTask(task, yPosition);
      }
  
      // Pied de page
      const pages = pdfDoc.getPages();
      pages.forEach((p, index) => {
        p.drawText(`Page ${index + 1}/${pages.length}`, {
          x: PAGE_WIDTH / 2 - 25,
          y: 20,
          size: 9,
          font: helvetica,
          color: primaryColor,
        });
      });
  
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const newUrl = URL.createObjectURL(blob);
  
      setPdfUrl(newUrl);
      setPdfBlob(blob);
  
      if (isMobileDevice()) {
        setShowDownloadModal(true);
      } else {
        window.open(newUrl, '_blank');
      }
  
      return pdfBytes;
  
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Une erreur est survenue lors de la génération du PDF.');
    } finally {
      setPdfGenerating(false);
    }
  }, [pdfUrl, pdfGenerating, trades]);

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

            // Dans le rendu de la liste des chantiers
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
                    {site.worker && (
                      <p className="text-sm text-gray-500 mb-2">
                        Ouvrier assigné : {site.worker.Name}
                      </p>
                    )}
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
          // Formater la mesure
          let measureText = '';
          if (task.measureType) {
            switch (task.measureType) {
              case 'square_meters':
                measureText = `${task.quantity || 0} m²`;
                break;
              case 'units':
                measureText = `${task.quantity || 0} unité${task.quantity > 1 ? 's' : ''}`;
                break;
              case 'fixed_price':
                measureText = 'Forfait';
                break;
            }
          }

          return (
            <div key={task.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{task.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-500">{trade?.name}</span>
                        {measureText && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-sm font-medium text-blue-600">
                              {measureText}
                            </span>
                          </>
                        )}
                      </div>
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
              {/* Reste du code pour l'affichage de la photo... */}
              
{task.photos?.length > 0 && (
  <div className="mt-3">
    <div className="flex flex-wrap gap-2">
      {task.photos.map((photo, index) => (
        <div key={photo.id} className="relative group">
          <button
            onClick={() => setModalState({
              type: 'view-photo',
              data: { photoUrl: photo.url }
            })}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Photo {index + 1}
          </button>
          <button
            onClick={() => {
              if (window.confirm('Êtes-vous sûr de vouloir supprimer cette photo ?')) {
                handlePhotoDelete(selectedSite.id, task.id, photo.id);
              }
            }}
            className="ml-2 text-red-600 hover:text-red-800 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ))}
      <label className="text-blue-600 hover:text-blue-800 cursor-pointer text-sm">
        + Ajouter une photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFirstPhotoAndComplete(selectedSite.id, task.id, file);
            }
          }}
        />
      </label>
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
                onClick={() => handleFirstPhotoAndComplete(
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