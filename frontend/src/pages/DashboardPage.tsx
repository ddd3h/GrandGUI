import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { WidgetCard } from '../components/widgets/WidgetCard';
import { useUiStore } from '../stores/uiStore';
import { api } from '../api/client';
import type { Dashboard, Widget } from '../types';

export function DashboardPage() {
  const [, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const { editMode } = useUiStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadDashboards = useCallback(async () => {
    try {
      const list = await api.getDashboards();
      setDashboards(list);
      const def = list.find((d) => d.is_default) || list[0];
      if (def) {
        setActiveDashboard(def);
        setWidgets(def.widgets || []);
      }
    } catch (e) {
      console.error('Failed to load dashboards', e);
    }
  }, []);

  useEffect(() => {
    loadDashboards();
  }, [loadDashboards]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = widgets.findIndex((w) => w.id === active.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);
    const newWidgets = arrayMove(widgets, oldIndex, newIndex);
    setWidgets(newWidgets);

    // Persist layout
    try {
      await api.patchLayout(
        newWidgets.map((w, i) => ({
          widget_id: w.id,
          device_profile: 'desktop',
          area: 'center',
          order_value: i,
          width_units: 1,
          height_units: 1,
          visibility: true,
        }))
      );
    } catch (e) {
      console.error('Failed to save layout', e);
      // Rollback
      setWidgets(widgets);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteWidget(id);
      setWidgets((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      console.error('Failed to delete widget', e);
    }
  };

  const handleAddWidget = async (type: Widget['widget_type']) => {
    if (!activeDashboard) return;
    try {
      const w = await api.createWidget({
        dashboard_id: activeDashboard.id,
        widget_type: type,
        title: type.charAt(0).toUpperCase() + type.slice(1),
        config: type === 'graph' ? { field: 'altitude', window: '5m' } : {},
        layouts: [{ area: 'center', order_value: widgets.length }],
      });
      setWidgets((prev) => [...prev, w]);
    } catch (e) {
      console.error('Failed to add widget', e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {editMode && (
        <div className="bg-orange-900/30 border-b border-orange-700/50 px-4 py-2 flex items-center gap-3">
          <span className="text-orange-300 text-sm font-medium">Edit Mode — drag cards to reorder</span>
          <div className="flex gap-2">
            {(['map', 'graph', 'status'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleAddWidget(t)}
                className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600"
              >
                + {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-min">
            {widgets.map((widget) => (
              <WidgetCard
                key={widget.id}
                widget={widget}
                onDelete={handleDelete}
              />
            ))}
            {widgets.length === 0 && (
              <div className="col-span-full flex items-center justify-center h-64 text-gray-500 text-sm">
                No widgets. Click "Edit Layout" to add some.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
