import { Download } from 'lucide-react';
import { exportCsv, exportTxt, type ExportPayload } from '@/services/exportService';

interface ExportButtonsProps {
  payload: ExportPayload;
}

export function ExportButtons({ payload }: ExportButtonsProps) {
  return (
    <div className="flex gap-3">
      <button className="btn-paper inline-flex items-center gap-2" onClick={() => exportCsv(payload)}>
        <Download className="h-4 w-4" /> CSV
      </button>
      <button className="btn-paper inline-flex items-center gap-2" onClick={() => exportTxt(payload)}>
        <Download className="h-4 w-4" /> TXT
      </button>
    </div>
  );
}
