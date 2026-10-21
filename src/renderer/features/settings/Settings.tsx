import React, { useState, useEffect } from 'react';
import { User, Briefcase, Shield, FileText, Plus, Trash2, Save } from 'lucide-react';

export function Settings() {
  const [profile, setProfile] = useState({
    name: '',
    profession: '',
    role: '',
    description: '',
    customFields: [] as { key: string; value: string }[]
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Fetch profile data from backend API
    fetch('http://127.0.0.1:8000/v1/profiles')
      .then(res => res.json())
      .then(data => {
        if (data) setProfile(data);
      })
      .catch(err => console.log('Using default profile state'));
  }, []);

  const handleAddCustomField = () => {
    setProfile({
      ...profile,
      customFields: [...profile.customFields, { key: '', value: '' }]
    });
  };

  const handleCustomFieldChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...profile.customFields];
    updated[index][field] = val;
    setProfile({ ...profile, customFields: updated });
  };

  const handleRemoveCustomField = (index: number) => {
    const updated = profile.customFields.filter((_, i) => i !== index);
    setProfile({ ...profile, customFields: updated });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('http://127.0.0.1:8000/v1/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        setMessage('Profile saved successfully!');
      } else {
        setMessage('Failed to save profile.');
      }
    } catch (err) {
      setMessage('Error connecting to backend API.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50 p-8 text-gray-800">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6 mb-12">
        
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-xl font-bold flex items-center gap-2 text-gray-900">
            <User className="w-5 h-5 text-indigo-600" /> User Profile Settings
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure your professional identity and custom attributes for FireForm.
          </p>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-xs font-medium ${message.includes('success') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={e => setProfile({ ...profile, name: e.target.value })}
                placeholder="e.g. Jane Doe"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Profession
              </label>
              <input
                type="text"
                value={profile.profession}
                onChange={e => setProfile({ ...profile, profession: e.target.value })}
                placeholder="e.g. Healthcare, Legal, Tech"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Role / Title
            </label>
            <input
              type="text"
              value={profile.role}
              onChange={e => setProfile({ ...profile, role: e.target.value })}
              placeholder="e.g. Attending Physician"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Bio / Description
            </label>
            <textarea
              rows={3}
              value={profile.description}
              onChange={e => setProfile({ ...profile, description: e.target.value })}
              placeholder="Brief professional summary..."
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Custom Fields</h3>
              <button
                type="button"
                onClick={handleAddCustomField}
                className="flex items-center gap-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition border border-gray-300"
              >
                <Plus className="w-3.5 h-3.5" /> Add Field
              </button>
            </div>

            <div className="space-y-3">
              {profile.customFields.map((field, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Key (e.g. Department)"
                    value={field.key}
                    onChange={e => handleCustomFieldChange(index, 'key', e.target.value)}
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. Cardiology)"
                    value={field.value}
                    onChange={e => handleCustomFieldChange(index, 'value', e.target.value)}
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomField(index)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving Profile...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default Settings;