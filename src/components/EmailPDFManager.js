import React from 'react';
import { Mail } from 'lucide-react';

const EmailPDFManager = ({ onSend, isGenerating }) => {
  const handleSendEmail = async (email) => {
    try {
      const pdfBytes = await onSend();
      if (!pdfBytes) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const fileName = `rapport-inspection-${new Date().toISOString().slice(0,10)}.pdf`;
      
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(pdfBlob);
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      
      const mailtoLink = `mailto:${email}?subject=${encodeURIComponent("Rapport d'inspection")}&body=${encodeURIComponent("Veuillez trouver ci-joint le rapport d'inspection.\n\nCordialement")}`;
      window.location.href = mailtoLink;
      
      downloadLink.click();
      
      document.body.removeChild(downloadLink);
      setTimeout(() => {
        URL.revokeObjectURL(downloadLink.href);
      }, 100);

    } catch (error) {
      console.error('Erreur lors de l\'envoi:', error);
      alert('Une erreur est survenue lors de l\'envoi du rapport. Veuillez réessayer.');
    }
  };

  return (
    <button
      onClick={() => {
        const email = document.getElementById('email')?.value;
        if (!email) {
          alert('Veuillez saisir une adresse email');
          return;
        }
        if (!email.includes('@')) {
          alert('Veuillez saisir une adresse email valide');
          return;
        }
        handleSendEmail(email);
      }}
      disabled={isGenerating}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
        isGenerating 
          ? 'bg-gray-400 cursor-not-allowed' 
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}
      title={isGenerating ? "Génération en cours..." : "Envoyer par email"}
    >
      <Mail className="h-4 w-4" />
      <span className="whitespace-nowrap">
        {isGenerating ? 'Génération...' : 'Envoyer'}
      </span>
    </button>
  );
};

export default EmailPDFManager;