import React, { useState, useCallback } from 'react';
import { Camera, Image } from 'lucide-react';
import { PhotoService } from '../services/photoService';

const PhotoUploadButton = ({ onFileSelected, siteId, taskId, className = "" }) => {
  const [isCompressing, setIsCompressing] = useState(false);

  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    
    try {
      setIsCompressing(true);
      
      const result = await PhotoService.uploadPhoto(file, siteId, taskId);
      onFileSelected(result.url, result.id);
      
    } catch (error) {
      console.error('Erreur lors du traitement:', error);
      alert('Erreur lors du traitement de l\'image');
    } finally {
      setIsCompressing(false);
    }
  }, [siteId, taskId, onFileSelected]);

  const handleCameraCapture = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleGallerySelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  return (
    <div className={`flex gap-2 ${className}`}>
      <label className={`flex items-center gap-2 ${
        isCompressing 
          ? 'bg-gray-400 cursor-wait' 
          : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
        } text-white px-3 py-1 rounded-lg transition-colors`}>
        <Camera className="h-4 w-4" />
        <span>{isCompressing ? 'Compression...' : 'Photo'}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCameraCapture}
          disabled={isCompressing}
        />
      </label>

      <label className={`flex items-center gap-2 ${
        isCompressing 
          ? 'bg-gray-400 cursor-wait' 
          : 'bg-gray-600 hover:bg-gray-700 cursor-pointer'
        } text-white px-3 py-1 rounded-lg transition-colors`}>
        <Image className="h-4 w-4" />
        <span>{isCompressing ? 'Compression...' : 'Galerie'}</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGallerySelect}
          disabled={isCompressing}
        />
      </label>
    </div>
  );
};

export default PhotoUploadButton;