import React, { useState, useRef } from 'react';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, storage, db } from '../firebase'; // Import your firebase config

const ProfilePopup = ({ isOpen, onClose, currentUser }) => {
  const [formData, setFormData] = useState({
    displayName: currentUser?.displayName || '',
    email: currentUser?.email || '',
    role: 'Project Manager',
    bio: ''
  });
  const [profileImage, setProfileImage] = useState(currentUser?.photoURL || null);
  const [imageFile, setImageFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Handle drag events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleImageFile(files[0]);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleImageFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload image to Firebase Storage
  const uploadProfileImage = async (file) => {
    if (!file || !currentUser) return null;

    const storageRef = ref(storage, `profile-images/${currentUser.uid}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let photoURL = profileImage;

      // Upload new image if selected
      if (imageFile) {
        photoURL = await uploadProfileImage(imageFile);
      }

      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: formData.displayName,
        photoURL: photoURL
      });

      // Update Firestore user document
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        displayName: formData.displayName,
        photoURL: photoURL,
        role: formData.role,
        bio: formData.bio,
        updatedAt: new Date()
      });

      alert('Profile updated successfully!');
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0f1629] border border-[#1e293b] rounded-2xl w-full max-w-2xl mx-4 shadow-2xl animate-[slideUp_0.3s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1e293b]">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[#f8fafc] to-[#00d4ff] bg-clip-text text-transparent">
            Edit Profile
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#1a1f3a] border border-[#1e293b] flex items-center justify-center text-[#94a3b8] hover:text-[#00d4ff] hover:border-[#00d4ff] transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Profile Photo Upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[#f8fafc] mb-3">
              Profile Photo
            </label>
            <div className="flex items-center gap-6">
              {/* Current Photo */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center font-bold text-2xl text-white overflow-hidden">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  formData.displayName?.charAt(0) || 'U'
                )}
              </div>

              {/* Drag & Drop Area */}
              <div
                className={`flex-1 border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-[#00d4ff] bg-[#00d4ff]/10'
                    : 'border-[#1e293b] bg-[#1a1f3a] hover:border-[#00d4ff]'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <svg className="w-10 h-10 mx-auto mb-2 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                <p className="text-sm text-[#f8fafc] font-semibold">
                  {isDragging ? 'Drop image here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-[#64748b] mt-1">PNG, JPG up to 5MB</p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-semibold text-[#f8fafc] mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="displayName"
                value={formData.displayName}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-[#1a1f3a] border border-[#1e293b] rounded-xl text-[#f8fafc] text-sm focus:outline-none focus:border-[#00d4ff] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)] transition-all"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-[#f8fafc] mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-3 bg-[#0f1629] border border-[#1e293b] rounded-xl text-[#64748b] text-sm cursor-not-allowed"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-semibold text-[#f8fafc] mb-2">
                Role
              </label>
              <input
                type="text"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-[#1a1f3a] border border-[#1e293b] rounded-xl text-[#f8fafc] text-sm focus:outline-none focus:border-[#00d4ff] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)] transition-all"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[#f8fafc] mb-2">
              Bio
            </label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              rows="3"
              className="w-full px-4 py-3 bg-[#1a1f3a] border border-[#1e293b] rounded-xl text-[#f8fafc] text-sm focus:outline-none focus:border-[#00d4ff] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)] transition-all resize-none"
              placeholder="Tell us about yourself..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-[#1a1f3a] border border-[#1e293b] rounded-xl text-[#f8fafc] font-semibold hover:border-[#00d4ff] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] rounded-xl text-white font-semibold hover:shadow-lg hover:shadow-[#00d4ff]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePopup;