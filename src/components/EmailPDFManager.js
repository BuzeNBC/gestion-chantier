import React from 'react';
import { Mail } from 'lucide-react';

const EmailPDFManager = ({ onSend, isGenerating }) => {
  const handleSendEmail = async (email) => {
    try {
      const pdfBytes = await onSend();
      if (!pdfBytes) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      // Créer un Blob et un fichier à partir des bytes du PDF
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const fileName = `rapport-inspection-${new Date().toISOString().slice(0,10)}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Vérifier si la Web Share API est disponible et supporte le partage de fichiers
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Rapport d'inspection",
            text: "Veuillez trouver ci-joint le rapport d'inspection"
          });
        } catch (error) {
          // Si l'utilisateur annule le partage, ne pas afficher d'erreur
          if (error.name !== 'AbortError') {
            throw error;
          }
        }
      } else {
        // Fallback pour les navigateurs qui ne supportent pas le Web Share API
        // Créer un Data URL pour le PDF
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        
        reader.onload = function() {
          const pdfBase64 = reader.result.split(',')[1];
          const mailtoLink = `mailto:${email}?subject=${encodeURIComponent("Rapport d'inspection")}&body=${encodeURIComponent("Veuillez trouver ci-joint le rapport d'inspection.")}\n\nAttachment: ${fileName}`;
          
          // Créer un élément pour télécharger le PDF
          const downloadLink = document.createElement('a');
          downloadLink.href = URL.createObjectURL(pdfBlob);
          downloadLink.download = fileName;
          document.body.appendChild(downloadLink);
          
          // Ouvrir le client mail et télécharger le PDF
          window.location.href = mailtoLink;
          downloadLink.click();
          
          // Nettoyer
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(downloadLink.href);
        };
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi:', error);
      alert('Une erreur est survenue lors de l\'envoi du rapport. Veuillez réessayer.');
    }
  };

  return (
    <button
      onClick={() => {
        const email = document.getElementById('email')?.value;
        if (email) {
          handleSendEmail(email);
        } else {
          alert('Veuillez saisir une adresse email');
        }
      }}
      disabled={isGenerating}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
        isGenerating 
          ? 'bg-gray-400 cursor-not-allowed' 
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}
    >
      <Mail className="h-4 w-4" />
      {isGenerating ? 'Génération en cours...' : 'Envoyer'}
    </button>
  );
};

export default EmailPDFManager;