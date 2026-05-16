import { Download } from 'lucide-react';
import { exportCsv, exportTxt, type ExportPayload } from '@/services/exportService';

interface ExportButtonsProps {
  payload: ExportPayload;
}

export function ExportButtons({ payload }: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <button type="button" className="btn-ghost text-xs" onClick={() => exportCsv(payload)}>
        <Download className="mr-1 h-3 w-3" strokeWidth={2} /> CSV
      </button>
      <button type="button" className="btn-ghost text-xs" onClick={() => exportTxt(payload)}>
        <Download className="mr-1 h-3 w-3" strokeWidth={2} /> TXT
      </button>
    </div>
  );
}
