import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fabric } from 'fabric';
import { submissionAPI, getFileUrl } from '../services/api';

const LoadingSpinner = ({ size = 'h-12 w-12' }) => (
  <div className={`animate-spin rounded-full ${size} border-b-2 border-primary-500`}></div>
);

const ErrorDisplay = ({ message }) => (
  <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
    <div className="flex">
      <svg className="flex-shrink-0 h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
      <div className="ml-3"><p className="text-sm text-red-700">{message}</p></div>
    </div>
  </div>
);

const AnnotationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);

  const [submission, setSubmission] = useState(null);
  const [annotationData, setAnnotationData] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [treatmentRecommendations, setTreatmentRecommendations] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [brushSize, setBrushSize] = useState(3);
  const [activeColor, setActiveColor] = useState('#DC2626');
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState('freehand');

  const COLORS = [
    { name: 'Inflamed / Red gums', value: '#7C2D12' },
    { name: 'Malaligned', value: '#7C3AED' },
    { name: 'Receded gums', value: '#059669' },
    { name: 'Stains', value: '#DC2626' },
    { name: 'Attrition', value: '#0891B2' },
    { name: 'Crowns', value: '#EC4899' },
  ];

  const stripImagesFromJSON = (json) => {
    if (!json) return json;
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      if (!parsed?.objects) return parsed;
      return { ...parsed, objects: parsed.objects.filter((o) => o?.type !== 'image') };
    } catch {
      return json;
    }
  };

  const addAnnotations = (canvas, json) => {
    if (!canvas || !json) return;
    const parsed = stripImagesFromJSON(json);
    const objs = parsed?.objects || [];
    if (!objs.length) return;
    fabric.util.enlivenObjects(objs, (enlivened) => {
      enlivened.forEach((o) => canvas.add(o));
      canvas.renderAll();
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const { data } = await submissionAPI.getSubmission(id);
        const sub = data.submission;
        setSubmission(sub);
        setTreatmentRecommendations(sub.treatmentRecommendations || '');
        const count = sub.originalImagePaths?.length || 1;
        setAnnotationData(sub.annotationData || Array(count).fill(null));
      } catch (e) {
        console.error(e);
        setError('Failed to load submission data.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (isLoading || !submission || !canvasRef.current) return;

    const originals = submission.originalImagePaths || [submission.originalImagePath];
    const basePath = originals[currentImageIndex] || originals[0];
    const imageUrl = getFileUrl(basePath);

    if (fabricCanvasRef.current) fabricCanvasRef.current.dispose();

    const container = canvasRef.current.parentElement;
    const canvas = new fabric.Canvas(canvasRef.current, { width: container.clientWidth, height: container.clientHeight, backgroundColor: '#f8f9fa' });
    fabricCanvasRef.current = canvas;

    fabric.Image.fromURL(imageUrl, (img) => {
      const scale = Math.min((canvas.width - 40) / img.width, (canvas.height - 40) / img.height, 1);
      img.set({ scaleX: scale, scaleY: scale, left: (canvas.width - img.width * scale) / 2, top: 20, selectable: false, evented: false });
      canvas.add(img);
      canvas.sendToBack(img);
      if (annotationData[currentImageIndex]) addAnnotations(canvas, annotationData[currentImageIndex]);
      setZoom(1);
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = brushSize;
    }, { crossOrigin: 'anonymous' });

    return () => { if (fabricCanvasRef.current) { fabricCanvasRef.current.dispose(); fabricCanvasRef.current = null; } };
  }, [submission, currentImageIndex, isLoading]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'default';

    if (activeTool === 'freehand') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = brushSize;
    } else if (activeTool === 'eraser') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = '#FFFFFF';
      canvas.freeDrawingBrush.width = Math.max(10, brushSize + 6);
    } else {
      canvas.defaultCursor = 'crosshair';
    }
    try {
      const z = Math.max(0.2, Math.min(zoom, 5));
      const center = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
      canvas.zoomToPoint(center, z);
    } catch {}
  }, [brushSize, activeColor, zoom, activeTool]);

  const persistLocalState = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const json = stripImagesFromJSON(canvas.toJSON());
    const next = [...annotationData];
    next[currentImageIndex] = json;
    setAnnotationData(next);
    return next;
  };

  const switchImage = (i) => {
    if (i === currentImageIndex) return;
    persistLocalState();
    setCurrentImageIndex(i);
  };

  const addShape = (shape) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const center = canvas.getCenter();
    let obj = null;
    const strokeProps = { stroke: activeColor, strokeWidth: 3, fill: 'transparent', selectable: true, evented: true };
    if (shape === 'rectangle') {
      obj = new fabric.Rect({ left: center.left - 50, top: center.top - 30, width: 100, height: 60, ...strokeProps });
    } else if (shape === 'circle') {
      obj = new fabric.Circle({ left: center.left - 40, top: center.top - 40, radius: 40, ...strokeProps });
    } else if (shape === 'arrow') {
      const line = new fabric.Line([0, 0, 100, 0], { stroke: activeColor, strokeWidth: 3 });
      const head = new fabric.Triangle({ left: 85, top: -8, width: 16, height: 16, fill: activeColor, angle: 90 });
      obj = new fabric.Group([line, head], { left: center.left - 50, top: center.top, selectable: true, evented: true });
    }
    if (obj) {
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.renderAll();
    }
  };

  const saveAll = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const latestAnnotations = persistLocalState() || annotationData;
      const o = submission?.originalImagePaths || [submission?.originalImagePath];
      const basePaths = o;

      for (let i = 0; i < basePaths.length; i++) {
        await new Promise((resolve) => {
          const canvas = fabricCanvasRef.current;
          if (!canvas) return resolve();
          canvas.clear();
          fabric.Image.fromURL(getFileUrl(basePaths[i]), (img) => {
            const scale = Math.min((canvas.width - 40) / img.width, (canvas.height - 40) / img.height, 1);
            img.set({ scaleX: scale, scaleY: scale, left: (canvas.width - img.width * scale) / 2, top: 20, selectable: false, evented: false });
            canvas.add(img);
            canvas.sendToBack(img);
            if (latestAnnotations[i]) addAnnotations(canvas, latestAnnotations[i]);
            canvas.renderAll();
            const dataForI = [...latestAnnotations];
            while (dataForI.length <= i) dataForI.push(null);
            dataForI[i] = stripImagesFromJSON(canvas.toJSON());
            const dataUrl = canvas.toDataURL({ format: 'png' });
            submissionAPI.saveAnnotation(id, {
              annotationData: dataForI,
              annotatedImageDataUrl: dataUrl,
              treatmentRecommendations,
              annotatedImageIndex: i,
            }).finally(resolve);
          }, { crossOrigin: 'anonymous' });
        });
      }
      navigate('/admin');
    } catch (e) {
      console.error(e);
      setError('Failed to save annotations. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (error && !submission) return <div className="min-h-screen flex items-center justify-center p-4"><ErrorDisplay message={error} /></div>;

  const annotatedList = submission?.annotatedImagePaths || [];
  const originalList = submission?.originalImagePaths || [submission?.originalImagePath];
  const maxLenList = Math.max((originalList || []).length, (annotatedList || []).length);
  const imagePaths = Array.from({ length: maxLenList }, (_, i) => annotatedList[i] || originalList[i]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm border-b z-10">
        <div className="max-w-full mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M13.196 3.196a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L13.196 3.196z" /></svg></div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Dental Annotation</h1>
                <p className="text-xs text-gray-500">Patient: {submission?.patientName} (Mobile: {submission?.mobileNumber || submission?.patientId})</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/admin')} className="px-4 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Back</button>
              <button onClick={saveAll} disabled={isSaving} className="inline-flex items-center px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">{isSaving ? <><LoadingSpinner size="h-4 w-4" /><span className="ml-2">Saving...</span></> : 'Save & Complete'}</button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-4 p-4">
        <aside className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Images ({imagePaths.length})</h3>
            <div className="space-y-2">
              {imagePaths.map((p, i) => (
                <button key={i} onClick={() => switchImage(i)} className={`relative w-full rounded-lg overflow-hidden transition-all duration-200 ${currentImageIndex===i?'ring-2 ring-primary-500':'hover:ring-2 hover:ring-gray-300'}`}>
                  <img src={getFileUrl(p)} alt={`Scan ${i+1}`} className="w-full h-20 object-cover" />
                  <div className={`absolute top-1 right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${currentImageIndex===i?'bg-primary-500 text-white':'bg-black bg-opacity-50 text-white'}`}>{i+1}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="col-span-7 bg-white rounded-xl shadow-sm border flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Image {currentImageIndex + 1} of {imagePaths.length}</h3>
            <div className="hidden md:flex items-center border rounded-lg overflow-hidden">
              <button onClick={() => setZoom((z)=>Math.max(0.2, parseFloat((z-0.1).toFixed(2))))} className="px-3 py-2 text-gray-600 hover:bg-gray-50">-</button>
              <div className="px-3 py-2 text-sm text-gray-700 bg-gray-50 border-l border-r">{Math.round(zoom*100)}%</div>
              <button onClick={() => setZoom((z)=>Math.min(5, parseFloat((z+0.1).toFixed(2))))} className="px-3 py-2 text-gray-600 hover:bg-gray-50">+</button>
              <button onClick={() => setZoom(1)} className="px-3 py-2 text-gray-600 hover:bg-gray-50">Fit</button>
            </div>
          </div>
          <div className="flex-1 p-2 bg-gray-50"><div className="h-[70vh] min-h-[420px] max-h-[78vh]"><canvas ref={canvasRef} className="rounded-lg shadow-inner border w-full h-full" /></div></div>
        </div>

        <aside className="col-span-3 space-y-4">
          {error && <ErrorDisplay message={error} />}
          <div className="bg-white rounded-xl shadow-sm border">
            <h3 className="text-sm font-semibold text-gray-800 p-4 border-b">Tools</h3>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setActiveTool('freehand')} className={`px-3 py-2 rounded border text-sm ${activeTool==='freehand'?'bg-primary-50 border-primary-300':'bg-white'}`}>✏️ Freehand</button>
                <button onClick={() => { setActiveTool('rectangle'); addShape('rectangle'); }} className={`px-3 py-2 rounded border text-sm ${activeTool==='rectangle'?'bg-primary-50 border-primary-300':'bg-white'}`}>⬛ Rectangle</button>
                <button onClick={() => { setActiveTool('circle'); addShape('circle'); }} className={`px-3 py-2 rounded border text-sm ${activeTool==='circle'?'bg-primary-50 border-primary-300':'bg-white'}`}>⭕ Circle</button>
                <button onClick={() => { setActiveTool('arrow'); addShape('arrow'); }} className={`px-3 py-2 rounded border text-sm ${activeTool==='arrow'?'bg-primary-50 border-primary-300':'bg-white'}`}>➡️ Arrow</button>
                <button onClick={() => setActiveTool('eraser')} className={`px-3 py-2 rounded border text-sm ${activeTool==='eraser'?'bg-primary-50 border-primary-300':'bg-white'}`}>🧹 Eraser</button>
              </div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-700">Brush size: {brushSize}px</span><input type="range" min="1" max="20" value={brushSize} onChange={(e)=>setBrushSize(parseInt(e.target.value))} /></div>
              <div className="space-y-2">
                {COLORS.map((c)=> (
                  <button key={c.value} onClick={()=>setActiveColor(c.value)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border ${activeColor===c.value?'bg-gray-50 ring-1 ring-primary-400':'hover:bg-gray-50'}`}>
                    <span className="flex items-center">
                      <span className="w-4 h-4 inline-block rounded-sm border mr-3" style={{backgroundColor:c.value}}></span>
                      <span className="text-gray-800">{c.name}</span>
                    </span>
                    {activeColor===c.value && <span className="text-primary-500">Selected</span>}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { const c=fabricCanvasRef.current; if(!c) return; const objs=c.getObjects(); if(objs.length>1) c.remove(objs[objs.length-1]); }} className="px-3 py-2 rounded border">Undo</button>
                <button onClick={() => { const c=fabricCanvasRef.current; if(!c) return; c.getObjects().filter(o=>o.type!=='image').forEach(o=>c.remove(o)); }} className="px-3 py-2 rounded border text-red-700">Clear</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border">
            <h3 className="text-sm font-semibold text-gray-800 p-4 border-b">Treatment Recommendations</h3>
            <div className="p-4"><textarea value={treatmentRecommendations} onChange={(e)=>setTreatmentRecommendations(e.target.value)} rows={10} className="w-full border rounded p-2 text-sm" placeholder="Enter treatment recommendations..." /></div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default AnnotationPage;