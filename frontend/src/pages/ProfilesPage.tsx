import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { UartProfile, UartProfileField } from '../types';

interface FieldEditorProps {
  fields: Partial<UartProfileField>[];
  onChange: (fields: Partial<UartProfileField>[]) => void;
}

function FieldEditor({ fields, onChange }: FieldEditorProps) {
  const add = () =>
    onChange([
      ...fields,
      {
        order_index: fields.length,
        key: `field_${fields.length}`,
        field_type: 'string',
        is_latitude: false,
        is_longitude: false,
        is_altitude: false,
        use_for_map: false,
        use_for_graph: false,
        use_for_status: false,
        is_hidden: false,
      },
    ]);

  const update = (i: number, patch: Partial<UartProfileField>) => {
    const updated = fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    onChange(updated);
  };

  const remove = (i: number) => onChange(fields.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-400">Fields</span>
        <button onClick={add} className="text-xs px-2 py-1 bg-blue-700 text-white rounded hover:bg-blue-600">
          + Add Field
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="text-gray-500 border-b border-gray-700">
              <th className="text-left py-1 pr-2">#</th>
              <th className="text-left py-1 pr-2">Key</th>
              <th className="text-left py-1 pr-2">Label</th>
              <th className="text-left py-1 pr-2">Type</th>
              <th className="text-center py-1 pr-2">Lat</th>
              <th className="text-center py-1 pr-2">Lon</th>
              <th className="text-center py-1 pr-2">Alt</th>
              <th className="text-center py-1 pr-2">Map</th>
              <th className="text-center py-1 pr-2">Graph</th>
              <th className="text-center py-1 pr-2">Status</th>
              <th className="text-left py-1"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={i} className="border-b border-gray-700/50">
                <td className="py-1 pr-2 text-gray-500">{i}</td>
                <td className="py-1 pr-2">
                  <input
                    value={f.key || ''}
                    onChange={(e) => update(i, { key: e.target.value })}
                    className="w-24 bg-gray-700 rounded px-1 py-0.5 text-white"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    value={f.label || ''}
                    onChange={(e) => update(i, { label: e.target.value })}
                    className="w-20 bg-gray-700 rounded px-1 py-0.5 text-white"
                  />
                </td>
                <td className="py-1 pr-2">
                  <select
                    value={f.field_type || 'string'}
                    onChange={(e) => update(i, { field_type: e.target.value as UartProfileField['field_type'] })}
                    className="bg-gray-700 rounded px-1 py-0.5 text-white"
                  >
                    <option value="string">string</option>
                    <option value="float">float</option>
                    <option value="int">int</option>
                    <option value="key_value_string">key:val</option>
                  </select>
                </td>
                {(['is_latitude', 'is_longitude', 'is_altitude', 'use_for_map', 'use_for_graph', 'use_for_status'] as const).map((bk) => (
                  <td key={bk} className="py-1 pr-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!f[bk]}
                      onChange={(e) => update(i, { [bk]: e.target.checked })}
                    />
                  </td>
                ))}
                <td className="py-1">
                  <button onClick={() => remove(i)} className="text-red-400 hover:text-red-300">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<UartProfile[]>([]);
  const [selected, setSelected] = useState<UartProfile | null>(null);
  const [fields, setFields] = useState<Partial<UartProfileField>[]>([]);
  const [form, setForm] = useState({ name: '', description: '', delimiter: ',', encoding: 'utf-8', is_default: false });
  const [sampleLine, setSampleLine] = useState('');
  const [sampleResult, setSampleResult] = useState<{ success: boolean; parsed?: Record<string, unknown>; error?: string } | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const list = await api.getProfiles();
    setProfiles(list);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectProfile = (p: UartProfile) => {
    setSelected(p);
    setForm({ name: p.name, description: p.description || '', delimiter: p.delimiter, encoding: p.encoding, is_default: p.is_default });
    setFields(p.fields);
    setSampleResult(null);
  };

  const handleSave = async () => {
    const body = { ...form, fields: fields.map((f, i) => ({ ...f, order_index: i })) };
    try {
      if (selected) {
        await api.updateProfile(selected.id, body);
        setMessage('Saved');
      } else {
        await api.createProfile(body);
        setMessage('Created');
        setForm({ name: '', description: '', delimiter: ',', encoding: 'utf-8', is_default: false });
        setFields([]);
      }
      await load();
    } catch (e: unknown) {
      setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDelete = async (id: number) => {
    await api.deleteProfile(id);
    if (selected?.id === id) { setSelected(null); setFields([]); }
    await load();
  };

  const handleValidate = async () => {
    if (!selected) return;
    const r = await api.validateSample(selected.id, sampleLine);
    setSampleResult(r);
  };

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto h-full">
      {/* Profile list */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-3">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Profiles</h3>
        <div className="space-y-1">
          {profiles.map((p) => (
            <div
              key={p.id}
              onClick={() => selectProfile(p)}
              className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer ${
                selected?.id === p.id ? 'bg-blue-700' : 'hover:bg-gray-700'
              }`}
            >
              <span className="text-sm text-white">
                {p.name} {p.is_default && <span className="text-xs text-blue-300">(default)</span>}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={() => { setSelected(null); setFields([]); setForm({ name: '', description: '', delimiter: ',', encoding: 'utf-8', is_default: false }); }}
            className="w-full text-sm py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded mt-2"
          >
            + New Profile
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="md:col-span-2 bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-4">
        <h3 className="text-sm font-medium text-gray-400">{selected ? `Edit: ${selected.name}` : 'New Profile'}</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Delimiter</label>
            <input value={form.delimiter} onChange={(e) => setForm((f) => ({ ...f, delimiter: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Description</label>
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300 col-span-2">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} />
            Set as default profile
          </label>
        </div>

        <FieldEditor fields={fields} onChange={setFields} />

        {/* Sample validate */}
        {selected && (
          <div className="border-t border-gray-700 pt-3 space-y-2">
            <h4 className="text-xs font-medium text-gray-400">Validate Sample Line</h4>
            <div className="flex gap-2">
              <input
                value={sampleLine}
                onChange={(e) => setSampleLine(e.target.value)}
                placeholder="Paste a sample UART line..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white font-mono"
              />
              <button onClick={handleValidate} className="px-3 py-1 bg-blue-700 text-white rounded text-sm hover:bg-blue-600">
                Test
              </button>
            </div>
            {sampleResult && (
              <div className={`text-xs p-2 rounded font-mono ${sampleResult.success ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                {sampleResult.success
                  ? JSON.stringify(sampleResult.parsed, null, 2)
                  : sampleResult.error}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium">
            {selected ? 'Save' : 'Create'}
          </button>
          {message && <span className={`text-sm ${message.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{message}</span>}
        </div>
      </div>
    </div>
  );
}
