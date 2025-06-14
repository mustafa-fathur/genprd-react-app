import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePRD } from '../hooks/usePRD';
import { TrashIcon, ExclamationTriangleIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';
import debounce from 'lodash/debounce'; // Change to specific import

// Import komponen-komponen terpisah
import LoadingSpinner from '../components/auth/LoadingSpinner';
import PRDDetailHeader from '../components/prd/PRDDetailHeader';
import PRDIdentitySection from '../components/prd/PRDIdentitySection';
import PRDOverviewSection from '../components/prd/PRDOverviewSection';
import PRDDarciSection from '../components/prd/PRDDarciSection';
import PRDUserStoriesSection from '../components/prd/PRDUserStoriesSection';
import PRDMetricsSection from '../components/prd/PRDMetricsSection';
import PRDTimelineSection from '../components/prd/PRDTimelineSection';
import PRDCustomSection from '../components/prd/PRDCustomSection';
import PRDSectionToolbar from '../components/prd/PRDSectionToolbar';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Toast from '../components/common/Toast'; // Import Toast component

// Fungsi untuk menggantikan uuidv4
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const PRDDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    getPRDById,
    updatePRD,
    deletePRD,
    archivePRD,
    updatePRDStage, // Make sure this is imported
    downloadPRD,
    setLoading: setApiLoading // Expose setLoading from hook
  } = usePRD();

  const [prd, setPRD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [customSections, setCustomSections] = useState([]);

  // State for Toast messages
  const [toastState, setToastState] = useState({
    isVisible: false,
    message: '',
    type: 'success',
  });

  // Helper to show toast
  const showToast = (message, type = 'success') => {
    setToastState({
      isVisible: true,
      message,
      type,
    });
  };

  // Helper to hide toast
  const hideToast = () => {
    setToastState(prev => ({ ...prev, isVisible: false }));
  };

  // Prevent multiple fetches with useRef
  const dataFetched = useRef(false);
  const requestInProgress = useRef(false);
  const isMounted = useRef(true);

  // Fetch PRD data only once
  useEffect(() => {
    isMounted.current = true;

    // Reset data fetch state when ID changes
    if (id) {
      dataFetched.current = false;
    }

    return () => {
      isMounted.current = false;
    };
  }, [id]);

  useEffect(() => {
    // Only fetch if we haven't already fetched or if id changes
    if (!dataFetched.current && !requestInProgress.current) {
      const fetchPRD = async () => {
        try {
          requestInProgress.current = true;
          setLoading(true);
          // Prevent usePRD from also showing its own loading state
          setApiLoading(false);
          setError(null);

          const response = await getPRDById(id);

          // Guard clause to prevent state updates if component unmounted
          if (!isMounted.current) return;

          if (response?.status === 'success') {
            setPRD(response.data);

            // Check for custom sections in generated_sections
            if (response.data.generated_sections?.custom_sections?.sections) {
              setCustomSections(response.data.generated_sections.custom_sections.sections);
            } else {
              // Initialize empty array if not found
              setCustomSections([]);
            }
          } else {
            setError('Failed to load PRD');
            showToast('Failed to load PRD', 'error'); // Show error toast
          }
          dataFetched.current = true;
        } catch (err) {
          if (!isMounted.current) return;

          console.error('Error loading PRD:', err);
          setError(err.message || 'Failed to load PRD');
          showToast(err.message || 'Failed to load PRD', 'error'); // Show error toast
        } finally {
          if (isMounted.current) {
            setLoading(false);
          }
          requestInProgress.current = false;
        }
      };

      fetchPRD();
    }
  }, [id, getPRDById, setApiLoading]);

  // Add inside component, before render
  const debouncedUpdate = useRef(
    debounce(async (data) => {
      try {
        const response = await updatePRD(id, data);
        if (response?.status === 'success' && response.data) {
          setPRD(response.data);
          if (response.data.custom_sections) {
            setCustomSections(response.data.custom_sections);
          }
          showToast('Changes saved successfully', 'success'); // Show success toast on debounced save
        } else {
           showToast('Failed to save changes', 'error'); // Show error toast
        }
      } catch (err) {
        console.error('Failed to save changes:', err);
        setSaveError('Failed to save changes');
        showToast('Failed to save changes', 'error'); // Show error toast
      }
    }, 1000)
  ).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  // Handle basic field changes
  const handleChange = (field, value) => {
    setPRD(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Use a more robust change handler that can update nested structures
  const handleDeepChange = (path, value) => {
    setPRD(prev => {
      const updated = { ...prev };
      // Simple deep update for common cases (e.g., 'field', 'section.field', 'section.array[index].field')
      const keys = path.split('.');
      let current = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        const arrayMatch = key.match(/(.+)\[(\d+)\]/);
        if (arrayMatch) {
          const arrayKey = arrayMatch[1];
          const index = parseInt(arrayMatch[2]);
          if (!current[arrayKey]) current[arrayKey] = [];
          if (!current[arrayKey][index]) current[arrayKey][index] = {};
          current = current[arrayKey][index];
        } else {
          if (!current[key]) current[key] = {};
          current = current[key];
        }
      }
      const lastKey = keys[keys.length - 1];
      const lastArrayMatch = lastKey.match(/(.+)\[(\d+)\]/);
       if (lastArrayMatch) {
          const arrayKey = lastArrayMatch[1];
          const index = parseInt(lastArrayMatch[2]);
           if (!current[arrayKey]) current[arrayKey] = [];
          current[arrayKey][index] = value; // Assign value to array element
       } else {
         current[lastKey] = value;
       }

      // Trigger debounced save for any change
      debouncedUpdate(updated);

      return updated;
    });
  };

  const handleEdit = async (changes) => {
    // If changes is an object (updating fields)
    if (typeof changes === 'object') {
      console.log('Received changes:', changes); // Debug log

      // Update local state immediately for UI responsiveness
      setPRD(prev => ({
        ...prev,
        ...changes
      }));

      // Save changes to server
      try {
        const response = await updatePRD(id, {
          ...prd, // Include current PRD data
          ...changes // Overlay with new changes
        });

        if (response?.status === 'success' && response.data) {
          // Update state with server response to ensure consistency
          setPRD(response.data);
          showToast('PRD updated successfully', 'success'); // Show success toast
        } else {
           showToast('Failed to update PRD', 'error'); // Show error toast
        }
      } catch (err) {
        console.error('Failed to save changes:', err);
        // Revert changes if save failed
        setPRD(prev => ({
          ...prev,
          product_name: prd.product_name,
          document_version: prd.document_version
        }));
        setSaveError('Failed to save changes');
        showToast('Failed to update PRD', 'error'); // Show error toast
      }
    } else {
      // Just toggle edit mode
      setIsEditing(true);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (requestInProgress.current) return;

    try {
      requestInProgress.current = true;
      setLoading(true);

      await deletePRD(id);

      if (!isMounted.current) return;

      showToast('PRD deleted successfully', 'success'); // Show success toast
      navigate('/prds');

    } catch (err) {
      if (!isMounted.current) return;

      console.error('Error deleting PRD:', err);
      setSaveError(err.message || 'Failed to delete PRD');
      showToast(err.message || 'Failed to delete PRD', 'error'); // Show error toast

    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      requestInProgress.current = false;
    }
  };

  // Handle change document stage
  const handleChangeStage = async (stage) => {
    if (requestInProgress.current) return;

    try {
      requestInProgress.current = true;
      setLoading(true);
      setSaveError(null);

      const response = await updatePRDStage(id, stage);

      if (!isMounted.current) return;

      if (response?.status === 'success' && response.data) {
        setPRD(prev => ({
          ...prev,
          document_stage: response.data.document_stage
        }));
         showToast(`PRD stage updated to ${response.data.document_stage}`, 'success'); // Show success toast
      } else {
        setSaveError('Failed to update document stage');
        showToast('Failed to update document stage', 'error'); // Show error toast
      }
    } catch (err) {
      if (!isMounted.current) return;

      console.error('Error updating document stage:', err);
      setSaveError(err.message || 'Failed to update document stage');
      showToast(err.message || 'Failed to update document stage', 'error'); // Show error toast
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      requestInProgress.current = false;
    }
  };

  // Handle archive dengan confirmation modal
  const handleArchiveClick = () => {
    setShowArchiveModal(true);
  };

  const handleArchiveConfirm = async () => {
    setShowArchiveModal(false);

    if (requestInProgress.current) return;

    try {
      requestInProgress.current = true;
      setLoading(true);
      setSaveError(null);

      const isCurrentlyArchived = prd.document_stage === 'archived';
      let response;

      // Jika PRD saat ini diarsipkan, kita perlu me-unarchive dengan mengubah status
      if (isCurrentlyArchived) {
        response = await updatePRDStage(id, 'draft');
      } else {
        // Jika belum diarsipkan, gunakan endpoint archive
        response = await archivePRD(id);
      }

      if (!isMounted.current) return;

      if (response?.status === 'success' && response.data) {
        setPRD(prev => ({
          ...prev,
          document_stage: response.data.document_stage
        }));
        showToast(response.data.document_stage === 'archived' ? 'PRD archived successfully' : 'PRD unarchived successfully', 'success'); // Show success toast
      } else {
        setSaveError(`Failed to ${isCurrentlyArchived ? 'unarchive' : 'archive'} PRD`);
        showToast(`Failed to ${isCurrentlyArchived ? 'unarchive' : 'archive'} PRD`, 'error'); // Show error toast
      }
    } catch (err) {
      if (!isMounted.current) return;

      console.error(`Error ${prd.document_stage === 'archived' ? 'unarchiving' : 'archiving'} PRD:`, err);
      setSaveError(err.message || `Failed to ${prd.document_stage === 'archived' ? 'unarchive' : 'archive'} PRD`);
      showToast(err.message || `Failed to ${prd.document_stage === 'archived' ? 'unarchive' : 'archive'} PRD`, 'error'); // Show error toast
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      requestInProgress.current = false;
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (requestInProgress.current) return;

    try {
      requestInProgress.current = true;
      setLoading(true);
      setSaveError(null); // Clear previous save errors

      await downloadPRD(id);

      console.log('Download triggered successfully from PRDDetail page.');
      showToast('Download started successfully', 'success'); // Show success toast


    } catch (err) {
      if (!isMounted.current) return;

      console.error('Error downloading PRD in component:', err);
      // Use the error message provided by the hook
      setSaveError(err.message || 'Failed to download PRD.');
      showToast(err.message || 'Failed to download PRD', 'error'); // Show error toast
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      requestInProgress.current = false;
    }
  };

  // Perbaiki handleAddCustomSection
  const handleAddCustomSection = async (title) => {
    try {
      const newSection = {
        id: generateUUID(),
        title: title || 'New Section',
        content: '',
        layout: 'text',
        type: 'custom'
      };

      const updatedSections = [...customSections, newSection];
      setCustomSections(updatedSections);

      // Format data yang akan dikirim ke server
      const updatedGeneratedSections = {
        ...(prd.generated_sections || {}),
        custom_sections: {
          sections: updatedSections
        }
      };

      // Save ke database
      const payload = {
        ...prd,
        generated_sections: updatedGeneratedSections
      };

      // Hapus custom_sections dari root payload karena sudah masuk ke generated_sections
      delete payload.custom_sections;
      delete payload.id;
      delete payload.user_id;
      delete payload.created_at;
      delete payload.updated_at;

      console.log('Adding new custom section, payload:', payload);

      const response = await updatePRD(id, payload);

      if (response?.status === 'success' && response.data) {
        // Update state dengan respons server
        setPRD(response.data);

        // Extract custom sections dari response
        if (response.data.generated_sections?.custom_sections?.sections) {
          setCustomSections(response.data.generated_sections.custom_sections.sections);
        }
        showToast('Custom section added successfully', 'success'); // Show success toast
      } else {
         showToast('Failed to add custom section', 'error'); // Show error toast
      }
    } catch (err) {
      console.error('Failed to add custom section:', err);
      setSaveError('Failed to add custom section: ' + (err.message || 'Unknown error'));
      showToast('Failed to add custom section', 'error'); // Show error toast
    }
  };

  // Perbaiki handleUpdateCustomSection
  const handleUpdateCustomSection = async (updatedSection) => {
    // Update local state immediately
    const updatedSections = customSections.map(section =>
      section.id === updatedSection.id ? updatedSection : section
    );

    setCustomSections(updatedSections);

    try {
      // Format untuk dikirim ke server
      const updatedGeneratedSections = {
        ...(prd.generated_sections || {}),
        custom_sections: {
          sections: updatedSections
        }
      };

      // Kirim data ke server
      const payload = {
        ...prd,
        generated_sections: updatedGeneratedSections
      };

      // Hapus custom_sections dari root payload
      delete payload.custom_sections;
      delete payload.id;
      delete payload.user_id;
      delete payload.created_at;
      delete payload.updated_at;

      console.log('Saving PRD with custom sections:', updatedGeneratedSections.custom_sections);

      // Panggil API update PRD
      const response = await updatePRD(id, payload);

      if (response?.status === 'success' && response.data) {
        // Update with server response
        console.log('Server response after update:', response.data);

        setPRD(response.data);

        // Extract custom sections dari response
        if (response.data.generated_sections?.custom_sections?.sections) {
          setCustomSections(response.data.generated_sections.custom_sections.sections);
        }
        showToast('Custom section updated successfully', 'success'); // Show success toast
      } else {
         showToast('Failed to update custom section', 'error'); // Show error toast
      }
    } catch (err) {
      console.error('Failed to update custom section:', err);
      setSaveError('Failed to save custom section: ' + (err.message || 'Unknown error'));
      showToast('Failed to update custom section', 'error'); // Show error toast
    }
  };

  // Perbaiki handleDeleteCustomSection
  const handleDeleteCustomSection = async (sectionId) => {
    try {
      const updatedSections = customSections.filter(section => section.id !== sectionId);
      setCustomSections(updatedSections);

      // Format untuk dikirim ke server
      const updatedGeneratedSections = {
        ...(prd.generated_sections || {}),
        custom_sections: {
          sections: updatedSections
        }
      };

      // Save ke database setelah delete
      const payload = {
        ...prd,
        generated_sections: updatedGeneratedSections
      };

      // Hapus custom_sections dari root payload
      delete payload.custom_sections;
      delete payload.id;
      delete payload.user_id;
      delete payload.created_at;
      delete payload.updated_at;

      const response = await updatePRD(id, payload);

      if (response?.status === 'success' && response.data) {
        setPRD(response.data);

        // Extract custom sections dari response
        if (response.data.generated_sections?.custom_sections?.sections) {
          setCustomSections(response.data.generated_sections.custom_sections.sections);
        }
        showToast('Custom section deleted successfully', 'success'); // Show success toast
      } else {
         showToast('Failed to delete custom section', 'error'); // Show error toast
      }
    } catch (err) {
      console.error('Failed to delete custom section:', err);
      setSaveError('Failed to delete custom section: ' + (err.message || 'Unknown error'));
      showToast('Failed to delete custom section', 'error'); // Show error toast
    }
  };

  // Section management for built-in sections
  const handleSectionChange = (section, idx, field, value) => {
    setPRD(prev => {
      const updated = { ...prev };
      if (!updated.generated_sections) updated.generated_sections = {};
      if (!updated.generated_sections[section]) {
        if (section === 'overview') updated.generated_sections[section] = { sections: [] };
        else if (section === 'darci') updated.generated_sections[section] = { roles: [] };
        else if (section === 'user_stories') updated.generated_sections[section] = { stories: [] };
        else if (section === 'success_metrics') updated.generated_sections[section] = { metrics: [] };
        else if (section === 'project_timeline') updated.generated_sections[section] = { phases: [] };
      }

      const sectionKeyMap = {
        'overview': 'sections',
        'darci': 'roles',
        'user_stories': 'stories',
        'success_metrics': 'metrics',
        'project_timeline': 'phases'
      };

      const arrKey = sectionKeyMap[section];
      if (!arrKey) return updated;

      const arr = [...(updated.generated_sections[section][arrKey] || [])];
      arr[idx] = { ...arr[idx], [field]: value };
      updated.generated_sections[section][arrKey] = arr;
      
      // Trigger debounced save for section changes
      debouncedUpdate(updated);

      return updated;
    });
  };

  const handleAddSection = (section) => {
    setPRD(prev => {
      const updated = { ...prev };
      if (!updated.generated_sections) updated.generated_sections = {};

      const sectionConfigs = {
        'overview': { key: 'sections', template: { title: '', content: '' } },
        'darci': { key: 'roles', template: { name: '', members: [], guidelines: '' } },
        'user_stories': { key: 'stories', template: { title: '', priority: 'medium', user_story: '', acceptance_criteria: '' } },
        'success_metrics': { key: 'metrics', template: { name: '', target: '', current: '', definition: '' } },
        'project_timeline': { key: 'phases', template: { pic: '', activity: '', time_period: '' } }
      };

      const config = sectionConfigs[section];
      if (!config) return updated;

      if (!updated.generated_sections[section]) {
        updated.generated_sections[section] = { [config.key]: [] };
      }

      updated.generated_sections[section][config.key] = [
        ...(updated.generated_sections[section][config.key] || []),
        { ...config.template }
      ];
      
       // Trigger debounced save after adding section
       debouncedUpdate(updated);

      return updated;
    });
  };

  const handleRemoveSection = (section, idx) => {
    setPRD(prev => {
      const updated = { ...prev };
      if (!updated.generated_sections || !updated.generated_sections[section]) return updated;

      const sectionKeyMap = {
        'overview': 'sections',
        'darci': 'roles',
        'user_stories': 'stories',
        'success_metrics': 'metrics',
        'project_timeline': 'phases'
      };

      const arrKey = sectionKeyMap[section];
      if (!arrKey) return updated;

      const arr = [...(updated.generated_sections[section][arrKey] || [])];
      arr.splice(idx, 1);
      updated.generated_sections[section][arrKey] = arr;
      
      // Trigger debounced save after removing section
      debouncedUpdate(updated);

      return updated;
    });
  };

  // Stable loading state - we only check our own loading state, not apiLoading
  const isLoading = loading;

  // Loading state with smoother animation (without AnimatePresence)
  if (isLoading && !prd) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="flex items-center justify-center min-h-screen"
        >
          <LoadingSpinner size="xl" text="Loading PRD..." />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !prd) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div
          className="bg-white rounded-lg shadow-sm p-6 text-center border border-gray-200"
        >
          <ExclamationTriangleIcon className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading PRD</h2>
          <p className="text-gray-600 mb-4">{error || 'PRD not found'}</p>
          <button
            onClick={() => navigate('/prds')}
            className="inline-flex items-center px-4 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800"
          >
            Back to PRDs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8"
    >
      {/* Add loading overlay that doesn't unmount the page */}
      {isLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-70 z-50 flex items-center justify-center backdrop-blur-sm">
          <LoadingSpinner size="lg" text="Processing..." />
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-8 border border-gray-200">
        {/* Header with actions */}
        <PRDDetailHeader
          prd={prd}
          isEditing={isEditing}
          onEdit={handleEdit} // Pass handleEdit directly
          onSave={() => setIsEditing(false)} // Just handle edit mode
          onCancel={() => {
            setIsEditing(false);
            // Reset any unsaved changes - Note: This only resets top-level fields
            // A more robust solution would involve storing a copy of the initial PRD data
            if (prd) {
              setPRD(prev => ({
                ...prev,
                product_name: prd.product_name, // Assuming these are the main editable fields here
                document_version: prd.document_version
              }));
            }
          }}
          onDownload={handleDownload}
          onDelete={() => setShowDeleteModal(true)}
          onArchive={handleArchiveClick}
          onChangeStage={handleChangeStage}
        />
      </div>

      {/* PRD Identity Section */}
      {prd && (
        <PRDIdentitySection
          prd={prd}
          isEditing={isEditing}
          // Pass valid date strings or null/undefined if invalid
          // More robust date check
          startDate={prd.start_date && !isNaN(new Date(prd.start_date).getTime()) ? new Date(prd.start_date).toISOString().split('T')[0] : ''}
          endDate={prd.end_date && !isNaN(new Date(prd.end_date).getTime()) ? new Date(prd.end_date).toISOString().split('T')[0] : ''}
          onChange={handleDeepChange} // Use the new deep change handler
        />
      )}

      {/* PRD Overview Section */}
      <PRDOverviewSection
        prd={prd}
        isEditing={isEditing}
        onChange={handleChange}
        onAddSection={handleAddSection}
        onRemoveSection={handleRemoveSection}
        onSectionChange={handleSectionChange}
      />

      {/* DARCI Roles Section */}
      {prd.generated_sections?.darci?.roles && ( // Conditional render
        <PRDDarciSection
          prd={prd}
          isEditing={isEditing}
          onSectionChange={handleSectionChange}
          onRemoveSection={handleRemoveSection}
          onAddSection={handleAddSection}
        />
      )}

      {/* User Stories Section */}
      {prd.generated_sections?.user_stories?.stories && ( // Conditional render
        <PRDUserStoriesSection
          prd={prd}
          isEditing={isEditing}
          onSectionChange={handleSectionChange}
          onRemoveSection={handleRemoveSection}
          onAddSection={handleAddSection}
        />
      )}

      {/* Success Metrics Section */}
      {prd.generated_sections?.success_metrics?.metrics && ( // Conditional render
        <PRDMetricsSection
          prd={prd}
          isEditing={isEditing}
          onSectionChange={handleSectionChange}
          onRemoveSection={handleRemoveSection}
          onAddSection={handleAddSection}
        />
      )}

      {/* Project Timeline Section */}
      {prd.generated_sections?.project_timeline?.phases && ( // Conditional render
        <PRDTimelineSection
          prd={prd}
          isEditing={isEditing}
          onSectionChange={handleSectionChange}
          onRemoveSection={handleRemoveSection}
          onAddSection={handleAddSection}
        />
      )}

      {/* Custom Sections */}
      {customSections.map(section => (
        <PRDCustomSection
          key={section.id}
          section={section}
          isEditing={isEditing}
          onUpdate={handleUpdateCustomSection}
          onDelete={handleDeleteCustomSection}
        />
      ))}

      {/* Add New Section Toolbar - only visible in edit mode */}
      {isEditing && (
        <PRDSectionToolbar onAddCustomSection={handleAddCustomSection} />
      )}

      {/* Error message */} {/* Keep this for persistent errors like load failures */}
      {error && ( 
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Save Error message - Can potentially be replaced by toast */}
       {saveError && ( // Keep this for now, toast is transient
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{saveError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete PRD"
        message={
          <span>
            Are you sure you want to delete the PRD "<span className="font-semibold text-gray-700">
              {prd?.product_name}
            </span>"? This action cannot be undone.
          </span>
        }
        icon={<TrashIcon className="h-6 w-6 text-red-600" aria-hidden="true" />}
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* Archive Confirmation Modal */}
      <ConfirmationModal
        isOpen={showArchiveModal}
        title={prd?.document_stage === 'archived' ? "Unarchive PRD" : "Archive PRD"}
        message={
          <span>
            Are you sure you want to {prd?.document_stage === 'archived' ? "unarchive" : "archive"} the PRD "<span className="font-semibold text-gray-700">
              {prd?.product_name}
            </span>"?
            {prd?.document_stage !== 'archived' &&
              " Archived PRDs are moved out of your main PRD list but are still accessible."
            }
          </span>
        }
        icon={<ArchiveBoxIcon className="h-6 w-6 text-amber-600" aria-hidden="true" />}
        confirmText={prd?.document_stage === 'archived' ? "Unarchive" : "Archive"}
        confirmButtonClass="bg-amber-600 hover:bg-amber-700 focus:ring-amber-500"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setShowArchiveModal(false)}
      />
      
      {/* Toast component */}
       <Toast
        isVisible={toastState.isVisible}
        message={toastState.message}
        type={toastState.type}
        onClose={hideToast}
      />
    </div>
  );
};

export default PRDDetail;