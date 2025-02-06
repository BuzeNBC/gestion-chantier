import React from 'react';
import { Camera, Image } from 'lucide-react';

const PhotoUploadButton = ({ onFileSelected, className = "" }) => {
  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const handleGallerySelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Bouton Appareil Photo */}
      <label className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 cursor-pointer">
        <Camera className="h-4 w-4" />
        <span>Photo</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCameraCapture}
        />
      </label>

      {/* Bouton Galerie */}
      <label className="flex items-center gap-2 bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 cursor-pointer">
        <Image className="h-4 w-4" />
        <span>Galerie</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGallerySelect}
        />
      </label>
    </div>
  );
};

export default PhotoUploadButton;