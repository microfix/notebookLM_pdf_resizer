import React, { useState, useCallback, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { Upload, FileType, CheckCircle, AlertTriangle, Loader2, Download } from 'lucide-react';

const MB = 1024 * 1024;

export default function App() {
    const [files, setFiles] = useState([]);
    const [limitMB, setLimitMB] = useState(20);
    const [strategy, setStrategy] = useState('under'); // 'under' or 'over'
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [isDone, setIsDone] = useState(false);
    const [zipUrl, setZipUrl] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [generatedFiles, setGeneratedFiles] = useState([]);

    const fileInputRef = useRef(null);

    const onFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
        setFiles(prev => [...prev, ...selectedFiles]);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);

        const items = Array.from(e.dataTransfer.items);
        const pdfFiles = [];

        const scanEntries = async (entry) => {
            if (entry.isFile) {
                if (entry.name.toLowerCase().endsWith('.pdf')) {
                    const file = await new Promise((resolve) => entry.file(resolve));
                    pdfFiles.push(file);
                }
            } else if (entry.isDirectory) {
                const reader = entry.createReader();
                let entries = [];
                let readBatch = async () => {
                    const batch = await new Promise((resolve) => reader.readEntries(resolve));
                    if (batch.length > 0) {
                        entries = entries.concat(batch);
                        await readBatch();
                    }
                };
                await readBatch();
                for (const subEntry of entries) {
                    await scanEntries(subEntry);
                }
            }
        };

        const entries = items.map(item => item.webkitGetAsEntry()).filter(entry => entry !== null);

        setStatus('Scanner mapper...');
        for (const entry of entries) {
            await scanEntries(entry);
        }
        setStatus('');

        setFiles(prev => [...prev, ...pdfFiles]);
    };

    const processPDFs = async () => {
        if (files.length === 0) return;

        setIsProcessing(true);
        setIsDone(false);
        setProgress(0);
        setStatus('Sorterer filer...');

        // Sort files by name
        const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        const limitBytes = limitMB * MB;
        const effectiveLimit = strategy === 'under' ? limitBytes * 0.9 : limitBytes;
        const chunks = [];
        let currentChunk = [];
        let currentChunkSize = 0;

        setStatus('Planlægger pakker...');
        for (const file of sortedFiles) {
            if (strategy === 'under') {
                if (currentChunkSize + file.size > effectiveLimit && currentChunk.length > 0) {
                    chunks.push(currentChunk);
                    currentChunk = [file];
                    currentChunkSize = file.size;
                } else {
                    currentChunk.push(file);
                    currentChunkSize += file.size;
                }
            } else {
                // 'over' strategy: Includes the file that pushes it over the limit
                currentChunk.push(file);
                currentChunkSize += file.size;
                if (currentChunkSize >= limitBytes) {
                    chunks.push(currentChunk);
                    currentChunk = [];
                    currentChunkSize = 0;
                }
            }
        }
        if (currentChunk.length > 0) chunks.push(currentChunk);

        const zip = new JSZip();
        const results = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            setStatus(`Behandler pakke ${i + 1} af ${chunks.length}...`);

            const mergedPdf = await PDFDocument.create();

            for (const file of chunk) {
                const fileContent = await file.arrayBuffer();
                const pdf = await PDFDocument.load(fileContent);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const pdfBytes = await mergedPdf.save();
            const fileName = `samlet_pdf_del_${i + 1}.pdf`;
            zip.file(fileName, pdfBytes);
            results.push({ name: fileName, size: pdfBytes.length });

            setProgress(((i + 1) / chunks.length) * 100);
        }

        setGeneratedFiles(results);
        setStatus('Genererer ZIP fil...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);

        setZipUrl(url);
        setIsProcessing(false);
        setIsDone(true);
        setStatus('Færdig!');
    };

    const reset = () => {
        setFiles([]);
        setGeneratedFiles([]);
        setIsDone(false);
        setZipUrl(null);
        setProgress(0);
        setStatus('');
    };

    return (
        <div className="app-container">
            <h1>PDF Merger</h1>
            <p className="subtitle">Saml og chunk dine PDF-filer automatisk i rækkefølge</p>

            <div className="settings-grid">
                <div className="setting-group">
                    <label>Maks MB pr. fil</label>
                    <input
                        type="number"
                        value={limitMB}
                        onChange={(e) => setLimitMB(Number(e.target.value))}
                        min="1"
                    />
                </div>
                <div className="setting-group">
                    <label>Størrelse Strategi</label>
                    <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                        <option value="under">Hold under grænsen</option>
                        <option value="over">Må gerne gå over (inklusiv sidste fil)</option>
                    </select>
                </div>
            </div>

            <div className="warning-box">
                <AlertTriangle size={20} />
                <div>
                    <strong>Bemærk:</strong> Den endelige filstørrelse kan variere en smule fra summen af de enkelte filer pga. PDF-struktur.
                    En samlet PDF kan aldrig blive mindre end den største enkeltfil i pakken.
                </div>
            </div>

            {!isDone && !isProcessing && (
                <>
                    <div
                        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current.click()}
                    >
                        <Upload size={48} />
                        <div>
                            <p>Træk dine PDF-filer herind</p>
                            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Eller klik for at vælge</p>
                        </div>
                        <input
                            type="file"
                            multiple
                            accept="application/pdf"
                            style={{ display: 'none' }}
                            ref={fileInputRef}
                            onChange={onFileChange}
                        />
                    </div>

                    {files.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600 }}>{files.length} filer valgt</span>
                                <button
                                    onClick={() => setFiles([])}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
                                >
                                    Ryd alle
                                </button>
                            </div>
                            <div className="file-list">
                                {files.slice(0, 50).map((f, i) => (
                                    <div key={i} className="file-item">
                                        <span>{f.name}</span>
                                        <span style={{ opacity: 0.6 }}>{(f.size / MB).toFixed(2)} MB</span>
                                    </div>
                                ))}
                                {files.length > 50 && (
                                    <div className="file-item" style={{ justifyContent: 'center', opacity: 0.5 }}>
                                        ...og {files.length - 50} flere filer
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        onClick={processPDFs}
                        disabled={files.length === 0}
                    >
                        {isProcessing ? <Loader2 className="spin" /> : <FileType />}
                        Start sammenfletning
                    </button>
                </>
            )}

            {isProcessing && (
                <div className="progress-container">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="status-text">{status}</p>
                </div>
            )}

            {isDone && (
                <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s' }}>
                    <CheckCircle size={64} color="var(--success)" style={{ marginBottom: '1.5rem', margin: '0 auto 1.5rem auto', display: 'block' }} />
                    <h2 style={{ marginBottom: '1rem' }}>Succes! Dine PDF'er er klar.</h2>

                    <div className="file-list" style={{ marginBottom: '2rem', textAlign: 'left', maxHeight: '300px' }}>
                        <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--glass-border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Genererede filer</span>
                            <span>Størrelse</span>
                        </div>
                        {generatedFiles.map((file, idx) => (
                            <div key={idx} className="file-item">
                                <span>{file.name}</span>
                                <span style={{ opacity: 0.6 }}>{(file.size / MB).toFixed(2)} MB</span>
                            </div>
                        ))}
                        <div style={{ padding: '0.75rem 0.5rem', borderTop: '2px solid var(--glass-border)', fontWeight: 800, display: 'flex', justifyContent: 'space-between', color: 'var(--primary)' }}>
                            <span>Total størrelse</span>
                            <span>{(generatedFiles.reduce((acc, f) => acc + f.size, 0) / MB).toFixed(2)} MB</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <a href={zipUrl} download="samlede_pdf_filer.zip" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                            <Download /> Download ZIP
                        </a>
                        <button className="btn" onClick={reset} style={{ background: 'rgba(255,255,255,0.1)' }}>
                            Start forfra
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
