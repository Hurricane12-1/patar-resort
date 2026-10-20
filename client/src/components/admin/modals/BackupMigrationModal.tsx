import React from 'react';
import { toast } from '../../Toasts.tsx';

interface BackupMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLightMode: boolean;
  themeBorder: string;
  themeText: string;
  themeMuted: string;
  backupTab: 'export' | 'import';
  setBackupTab: (tab: 'export' | 'import') => void;
  handleDownloadExport: (format: 'sql' | 'json' | 'csv') => Promise<void>;
  downloadingExport: string | null;
  previewSqlText: string;
  setPreviewSqlText: (text: string) => void;
  loadingPreviewSql: boolean;
  setLoadingPreviewSql: (loading: boolean) => void;
  importContent: string;
  setImportContent: (content: string) => void;
  importMode: 'append' | 'overwrite';
  setImportMode: (mode: 'append' | 'overwrite') => void;
  importingBackup: boolean;
  handleExecuteImport: () => Promise<void>;
  onFetchBackupText?: (format: 'sql' | 'json' | 'csv') => Promise<string>;
}

export default function BackupMigrationModal({
  isOpen,
  onClose,
  isLightMode,
  themeBorder,
  themeText,
  themeMuted,
  backupTab,
  setBackupTab,
  handleDownloadExport,
  downloadingExport,
  previewSqlText,
  setPreviewSqlText,
  loadingPreviewSql,
  setLoadingPreviewSql,
  importContent,
  setImportContent,
  importMode,
  setImportMode,
  importingBackup,
  handleExecuteImport,
  onFetchBackupText,
}: BackupMigrationModalProps) {
  if (!isOpen) return null;

  const detectFormat = (text: string) => {
    const t = text.trim();
    if (!t) return { label: 'Awaiting file or pasted text…', color: '#64748B', icon: 'fas fa-circle-info' };
    if (
      t.includes('INSERT INTO') ||
      t.includes('CREATE TABLE') ||
      (t.startsWith('BEGIN;') && t.includes('INSERT INTO')) ||
      /INSERT\s+INTO\s+[a-z0-9_.]*ledger_entries/i.test(t)
    ) {
      return { label: 'Detected Format: PostgreSQL Dump (SQL)', color: '#10B981', icon: 'fas fa-database' };
    }
    if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
      return { label: 'Detected Format: JSON Ledger Data', color: '#0EA5E9', icon: 'fas fa-file-code' };
    }
    if (
      t.includes(',') &&
      (t.toLowerCase().includes('debit') ||
        t.toLowerCase().includes('credit') ||
        t.toLowerCase().includes('particulars'))
    ) {
      return { label: 'Detected Format: CSV Spreadsheet', color: '#F59E0B', icon: 'fas fa-chart-pie' };
    }
    if (t.includes('|') || t.match(/\d+[\d,]*\s*-\s*\d+[\d,]*\s*=/)) {
      return { label: 'Detected Format: Physical Logbook Notation', color: '#8B5CF6', icon: 'fas fa-clipboard-list' };
    }
    return { label: 'Detected Format: Raw Text / Auto-Adaptive', color: '#0EA5E9', icon: 'fas fa-bolt' };
  };

  const detected = detectFormat(importContent);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 12px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 780,
          background: isLightMode ? '#FFFFFF' : '#0F172A',
          borderRadius: 22,
          border: `1px solid ${themeBorder}`,
          boxShadow: '0 25px 60px -12px rgba(0,0,0,0.6)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${themeBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '.72rem',
                color: '#6366F1',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
              }}
            >
              POSTGRESQL & SUPABASE DATA PLATFORM
            </span>
            <h3
              className="serif"
              style={{
                fontSize: '1.25rem',
                margin: '4px 0 0',
                color: themeText,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <i className="fas fa-database" style={{ marginRight: 6 }} />
              PostgreSQL Ledger Backup & Adaptive Migration
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: themeMuted,
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Sub-Tabs: Export vs Import */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${themeBorder}`, padding: '0 24px', gap: 16 }}>
          <button
            onClick={() => setBackupTab('export')}
            style={{
              padding: '12px 14px',
              border: 'none',
              borderBottom: `2px solid ${backupTab === 'export' ? '#6366F1' : 'transparent'}`,
              background: 'transparent',
              color: backupTab === 'export' ? (isLightMode ? '#4338CA' : '#818CF8') : themeMuted,
              fontWeight: 700,
              fontSize: '.84rem',
              cursor: 'pointer',
            }}
          >
            <i className="fas fa-upload" style={{ marginRight: 6 }} />
            Export PostgreSQL Backup
          </button>
          <button
            onClick={() => setBackupTab('import')}
            style={{
              padding: '12px 14px',
              border: 'none',
              borderBottom: `2px solid ${backupTab === 'import' ? '#6366F1' : 'transparent'}`,
              background: 'transparent',
              color: backupTab === 'import' ? (isLightMode ? '#4338CA' : '#818CF8') : themeMuted,
              fontWeight: 700,
              fontSize: '.84rem',
              cursor: 'pointer',
            }}
          >
            <i className="fas fa-download" style={{ marginRight: 6 }} />
            Adaptive Import & Restore
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {backupTab === 'export' ? (
            <div>
              <p style={{ margin: '0 0 16px', color: themeMuted, fontSize: '.84rem' }}>
                Generate complete PostgreSQL backups adhering to the <strong>public.ledger_entries</strong> schema.
                Choose your desired target format below:
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                {/* SQL Dump */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 14,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <i
                    className="fas fa-database"
                    style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8, color: '#336791' }}
                  />
                  <b style={{ color: themeText, fontSize: '.92rem', display: 'block' }}>
                    PostgreSQL SQL Dump (.sql)
                  </b>
                  <p style={{ color: themeMuted, fontSize: '.74rem', margin: '4px 0 14px' }}>
                    Full DDL, indexes, and transactional INSERT clauses with ON CONFLICT resolution for PostgreSQL 15+ /
                    Supabase.
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleDownloadExport('sql')}
                      disabled={downloadingExport === 'sql'}
                      className="btn btn-sky btn-sm"
                      style={{ fontSize: '.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <i className="fas fa-download" /> {downloadingExport === 'sql' ? 'Exporting…' : 'Download .sql'}
                    </button>
                    {onFetchBackupText && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '.74rem', color: themeText, border: `1px solid ${themeBorder}` }}
                        onClick={async () => {
                          setLoadingPreviewSql(true);
                          try {
                            const text = await onFetchBackupText('sql');
                            setPreviewSqlText(text);
                          } catch (e: any) {
                            toast(e.message, true);
                          } finally {
                            setLoadingPreviewSql(false);
                          }
                        }}
                      >
                        {loadingPreviewSql ? (
                          'Loading…'
                        ) : (
                          <>
                            <i className="fas fa-eye" style={{ marginRight: 4 }} />
                            View / Copy
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* JSON Archive */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 14,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <i
                    className="fas fa-file-code"
                    style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8, color: '#0EA5E9' }}
                  />
                  <b style={{ color: themeText, fontSize: '.92rem', display: 'block' }}>
                    Structured JSON Backup (.json)
                  </b>
                  <p style={{ color: themeMuted, fontSize: '.74rem', margin: '4px 0 14px' }}>
                    JSON archive containing complete ledger records, Trial Balance audit metrics, and Chart of Accounts
                    catalog.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDownloadExport('json')}
                    disabled={downloadingExport === 'json'}
                    className="btn btn-sky btn-sm"
                    style={{ fontSize: '.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <i className="fas fa-download" /> {downloadingExport === 'json' ? 'Exporting…' : 'Download .json'}
                  </button>
                </div>

                {/* CSV Spreadsheet */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 14,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <i
                    className="fas fa-file-csv"
                    style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8, color: '#F59E0B' }}
                  />
                  <b style={{ color: themeText, fontSize: '.92rem', display: 'block' }}>RFC 4180 CSV (.csv)</b>
                  <p style={{ color: themeMuted, fontSize: '.74rem', margin: '4px 0 14px' }}>
                    Universal spreadsheet format with dates, accounts, separate debit/credit columns, and running
                    balance.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDownloadExport('csv')}
                    disabled={downloadingExport === 'csv'}
                    className="btn btn-sky btn-sm"
                    style={{ fontSize: '.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <i className="fas fa-download" /> {downloadingExport === 'csv' ? 'Exporting…' : 'Download .csv'}
                  </button>
                </div>
              </div>

              {/* SQL Code Preview box */}
              {previewSqlText && (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: '.74rem', color: themeMuted, fontWeight: 700 }}>
                      POSTGRESQL DUMP PREVIEW
                    </span>
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ fontSize: '.72rem', color: '#0EA5E9' }}
                      onClick={() => {
                        navigator.clipboard.writeText(previewSqlText);
                        toast('✦ PostgreSQL SQL dump copied to clipboard!');
                      }}
                    >
                      <i className="fas fa-clipboard" style={{ marginRight: 4 }} />
                      Copy to Clipboard
                    </button>
                  </div>
                  <textarea
                    readOnly
                    rows={10}
                    value={previewSqlText}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 10,
                      fontFamily: 'monospace',
                      fontSize: '.78rem',
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F1F5F9' : '#020617',
                      color: themeText,
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 14px', color: themeMuted, fontSize: '.84rem' }}>
                The <strong>Adaptive Import Engine</strong> automatically recognizes your data format: PostgreSQL SQL
                dump (INSERT/CREATE TABLE), JSON archives, CSV spreadsheets, or physical logbook notations.
              </p>

              {/* Format Auto-Detection Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '.78rem',
                    fontWeight: 700,
                    color: detected.color,
                    background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: `1px solid ${detected.color}`,
                  }}
                >
                  <span>
                    <i className={detected.icon} />
                  </span>{' '}
                  {detected.label}
                </div>
                <label
                  style={{
                    fontSize: '.78rem',
                    color: '#0EA5E9',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <i className="fas fa-folder-open" style={{ marginRight: 4 }} />
                  Upload File (.sql, .json, .csv, .txt)
                  <input
                    type="file"
                    accept=".sql,.json,.csv,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const text = evt.target?.result;
                          if (typeof text === 'string') {
                            setImportContent(text);
                            toast(`✦ File loaded: ${file.name} (${Math.round(file.size / 1024)} KB)`);
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </label>
              </div>

              {/* Textarea for Import Content */}
              <textarea
                rows={9}
                placeholder="Paste PostgreSQL SQL statements, JSON records, CSV text, or pipe-delimited logbook lines here…"
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 10,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#FFF' : '#1E293B',
                  color: themeText,
                  fontFamily: 'monospace',
                  fontSize: '.78rem',
                  marginBottom: 14,
                }}
              />

              {/* Import Mode Options */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    fontSize: '.78rem',
                    color: themeMuted,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Import Restoration Strategy
                </label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '.82rem',
                      color: themeText,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                    />
                    <b>Append & Reconcile (Recommended)</b> — Preserves existing entries, only adds new records
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '.82rem',
                      color: isLightMode ? '#DC2626' : '#F87171',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'overwrite'}
                      onChange={() => setImportMode('overwrite')}
                    />
                    <b>Complete Overwrite & Restore</b> — Clears current ledger and restores from backup
                  </label>
                </div>
              </div>

              {/* Execute Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onClose}
                  style={{ color: themeText }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sky btn-sm"
                  disabled={importingBackup || !importContent.trim()}
                  onClick={handleExecuteImport}
                  style={{ fontWeight: 700 }}
                >
                  {importingBackup ? (
                    'Parsing & Restoring…'
                  ) : (
                    <>
                      <i className="fas fa-rocket" style={{ marginRight: 6 }} />
                      Execute Adaptive Import ✦
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
