"use client";
import Button from './Button';
import InputField from './ui/InputField';
import SelectField from './ui/SelectField';
import TextareaField from './ui/TextareaField';

const fields = [
  ['name', 'Name', 'text', 'Member name'],
  ['aliases', 'Also known as', 'text', 'Comma separated aliases'],
  ['pronouns', 'Pronouns', 'text', 'e.g. they/them'],
  ['email', 'Email', 'email', 'name@example.com'],
  ['timezone', 'Timezone', 'text', 'e.g. Asia/Taipei'],
  ['joinedOn', 'Joined on', 'date'],
  ['birthday', 'Birthday', 'date'],
  ['photoURL', 'Profile photo URL', 'url', 'https://…'],
];

export default function MemberForm({ draft, onChange, onSubmit, onCancel, roleOptions, creating = false }) {
  function field(key, label, type = 'text', placeholder) {
    const update = event => onChange(key, event.target.value);
    return <label key={key} className="member-editor-field"><span>{label}</span><InputField type={type} value={draft[key]} placeholder={placeholder} required={key === 'name'} autoFocus={key === 'name'} onChange={update} onInput={type === 'date' ? update : undefined} onBlur={type === 'date' ? update : undefined} min={key === 'leftOn' ? draft.joinedOn || undefined : undefined} /></label>;
  }
  return <form className="member-editor-form" onSubmit={onSubmit}>
    {fields.slice(0, 3).map(args => field(...args))}
    <label className="member-editor-field"><span>Role</span><SelectField value={draft.role} onChange={event => onChange('role', event.target.value)}>{roleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField></label>
    {fields.slice(3).map(args => field(...args))}
    <label className="member-editor-toggle"><input type="checkbox" checked={Boolean(draft.active)} onChange={event => onChange('active', event.target.checked)} /><span>Active member</span></label>
    {!draft.active && field('leftOn', 'Left on', 'date')}
    <label className="member-editor-field"><span>Notes</span><TextareaField value={draft.notes} onChange={event => onChange('notes', event.target.value)} placeholder="A little context about this member…" rows={3} /></label>
    <div className="member-editor-actions"><Button type="submit" disabled={!draft.name.trim()}>{creating ? 'Add member' : 'Save'}</Button><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></div>
  </form>;
}
