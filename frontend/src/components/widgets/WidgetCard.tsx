import { useState, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapWidget } from './MapWidget';
import { GraphWidget } from './GraphWidget';
import { StatusWidget } from './StatusWidget';
import type { Widget } from '../../types';
import { useUiStore } from '../../stores/uiStore';

interface WidgetCardProps {
  widget: Widget;
  onDelete?: (id: number) => void;
}

// Header (py-2 + text + border) ≈ 41px, resize handle (h-3) = 12px
const CHROME_HEIGHT = 53;
const MIN_MAP_HEIGHT = 200;
const DEFAULT_MAP_HEIGHT = 420;

export function WidgetCard({ widget, onDelete }: WidgetCardProps) {
  const { editMode } = useUiStore();
  const isMap = widget.widget_type === 'map';
  const [mapHeight, setMapHeight] = useState(DEFAULT_MAP_HEIGHT);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    // Explicit height for map cards so the card truly shrinks when resized.
    // Non-map cards size themselves to content via min-h.
    ...(isMap ? { height: mapHeight + CHROME_HEIGHT } : {}),
  };

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = mapHeight;

    const onMouseMove = (ev: MouseEvent) => {
      const next = Math.max(MIN_MAP_HEIGHT, startHeight + ev.clientY - startY);
      setMapHeight(next);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [mapHeight]);

  const renderContent = () => {
    const cfg = (widget.config || {}) as Record<string, unknown>;
    switch (widget.widget_type) {
      case 'map':
        return (
          <MapWidget
            trackLength={typeof cfg.trackLength === 'number' ? cfg.trackLength : 500}
          />
        );
      case 'graph':
        return (
          <GraphWidget
            field={((cfg.field as string) || 'altitude') as keyof import('../../types').TelemetryPoint}
            title={widget.title}
            window={(cfg.window as '1m' | '5m' | '15m' | 'all') || '5m'}
          />
        );
      case 'status':
        return <StatusWidget />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            Unknown widget type: {widget.widget_type}
          </div>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-800 rounded-xl border overflow-hidden flex flex-col ${
        isDragging ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-gray-700'
      } ${!isMap ? 'min-h-[200px]' : 'self-start w-full'}`}
    >
      {/* Card header */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-gray-700 flex-shrink-0 ${
          editMode ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        {...(editMode ? { ...attributes, ...listeners } : {})}
      >
        <span className="text-sm font-medium text-gray-200">
          {editMode && <span className="text-gray-500 mr-2">⠿</span>}
          {widget.title || widget.widget_type}
        </span>
        <div className="flex items-center gap-2">
          {isMap && editMode && (
            <span className="text-gray-500 text-xs">↕ 下端ドラッグでリサイズ</span>
          )}
          {editMode && onDelete && (
            <button
              onClick={() => onDelete(widget.id)}
              className="text-red-400 hover:text-red-300 text-sm px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>

      {/* Resize handle — map only */}
      {isMap && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="h-3 flex items-center justify-center cursor-ns-resize hover:bg-gray-600 transition-colors flex-shrink-0 border-t border-gray-700 group"
          title="ドラッグしてサイズ変更"
        >
          <div className="w-10 h-0.5 bg-gray-600 group-hover:bg-gray-400 rounded-full transition-colors" />
        </div>
      )}
    </div>
  );
}
