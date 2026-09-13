import { useCallback, useEffect, useState } from 'react'
import { BackgroundPanel } from './components/BackgroundPanel'
import { ExportPanel } from './components/ExportPanel'
import { NamesPanel } from './components/NamesPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { StylePanel } from './components/StylePanel'
import { TemplateControls, type Notice } from './components/TemplateControls'
import { initialState, type CertificateState, type UpdateState } from './state/certificate'
import { loadSettings, saveSettings } from './state/storage'

/** Wait this long after the last change before saving, so a drag saves once. */
const SAVE_DELAY_MS = 400

function App() {
  // The last layout from this browser, read once on start.
  const [restored] = useState(loadSettings)
  const [state, setState] = useState<CertificateState>(() => ({ ...initialState, ...restored?.patch }))
  const [notice, setNotice] = useState<Notice | null>(() =>
    restored?.notes.length ? { level: 'info', text: restored.notes.join(' ') } : null,
  )
  const update = useCallback<UpdateState>((patch) => setState((s) => ({ ...s, ...patch })), [])

  const { backgroundFit, nameLayer, customFontName, showGuides } = state
  useEffect(() => {
    const timer = setTimeout(
      () => saveSettings({ backgroundFit, nameLayer, customFontName, showGuides }),
      SAVE_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [backgroundFit, nameLayer, customFontName, showGuides])

  // Each panel gets only the values it uses, so dragging the name does not
  // redraw the names table.
  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Certificate Generator</h1>
          <p className="tagline">A4 landscape certificates in bulk. Everything stays on this computer.</p>
        </div>
        <TemplateControls
          background={state.background}
          backgroundFit={state.backgroundFit}
          nameLayer={state.nameLayer}
          customFontName={state.customFontName}
          update={update}
          onNotice={setNotice}
        />
      </header>

      {notice && (
        <div className={`notice message message-${notice.level}`} role="status" data-testid="notice">
          <span>{notice.text}</span>
          <button type="button" className="link" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <main className="layout">
        <div className="column">
          <section className="panel" aria-labelledby="panel-background">
            <h2 id="panel-background">1. Background</h2>
            <BackgroundPanel background={state.background} backgroundFit={state.backgroundFit} update={update} />
          </section>

          <section className="panel" aria-labelledby="panel-names">
            <h2 id="panel-names">2. Names</h2>
            <NamesPanel names={state.names} update={update} />
          </section>
        </div>

        <section className="panel panel-preview" aria-labelledby="panel-preview">
          <h2 id="panel-preview">3. Preview and placement</h2>
          <PreviewPanel
            background={state.background}
            backgroundFit={state.backgroundFit}
            names={state.names}
            nameLayer={state.nameLayer}
            customFontName={state.customFontName}
            showGuides={state.showGuides}
            previewIndex={state.previewIndex}
            update={update}
          />
        </section>

        <section className="panel" aria-labelledby="panel-style">
          <h2 id="panel-style">4. Style and export</h2>
          <StylePanel
            names={state.names}
            nameLayer={state.nameLayer}
            customFontName={state.customFontName}
            update={update}
          />
          <ExportPanel
            background={state.background}
            backgroundFit={state.backgroundFit}
            names={state.names}
            nameLayer={state.nameLayer}
            previewIndex={state.previewIndex}
          />
        </section>
      </main>

      <footer className="app-footer">
        <span>v{__APP_VERSION__}</span>
        <span>Files are processed in your browser. Nothing is uploaded.</span>
      </footer>
    </div>
  )
}

export default App
