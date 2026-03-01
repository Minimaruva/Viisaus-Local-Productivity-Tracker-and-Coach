/**
 * BlocklistManager.jsx
 *
 * Allows the user to add and remove app names / domains from the blocklist.
 *
 * Props:
 *  items     {Array<{ id: number, app_or_url_name: string }>}
 *  onAdd     {function(name: string): Promise<void>}
 *  onRemove  {function(id: number): Promise<void>}
 */

import React, { useState } from 'react';

export default function BlocklistManager({ items, onAdd, onRemove }) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError('Please enter an app name or domain.');
      return;
    }

    setAdding(true);
    setError('');
    try {
      await onAdd(trimmed);
      setInputValue('');
    } catch (err) {
      setError(err.message || 'Failed to add entry.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id) => {
    try {
      await onRemove(id);
    } catch (err) {
      console.error('[BlocklistManager] Remove failed:', err);
    }
  };

  return (
    <section className="blocklist-manager" aria-label="Blocklist manager">
      <h2 className="blocklist-manager__title">Blocklist</h2>
      <p className="blocklist-manager__description">
        Enter an app name (e.g.&nbsp;<em>Slack</em>) or a domain (e.g.&nbsp;
        <em>reddit.com</em>). The tracker will alert you whenever that window
        is in focus.
      </p>

      {/* Add form */}
      <form className="blocklist-manager__form" onSubmit={handleAdd}>
        <input
          className="blocklist-manager__input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="reddit.com or Slack"
          aria-label="App name or domain to block"
          disabled={adding}
          autoComplete="off"
          spellCheck="false"
        />
        <button
          className="btn btn--secondary"
          type="submit"
          disabled={adding || !inputValue.trim()}
          aria-label="Add to blocklist"
        >
          {adding ? '…' : '+ Add'}
        </button>
      </form>

      {error && (
        <p className="blocklist-manager__error" role="alert">
          {error}
        </p>
      )}

      {/* List */}
      {items.length === 0 ? (
        <p className="blocklist-manager__empty">Your blocklist is empty.</p>
      ) : (
        <ul className="blocklist-manager__list" aria-label="Blocked apps and domains">
          {items.map((item) => (
            <li key={item.id} className="blocklist-manager__item">
              <span className="blocklist-manager__name">{item.app_or_url_name}</span>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => handleRemove(item.id)}
                aria-label={`Remove ${item.app_or_url_name} from blocklist`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
