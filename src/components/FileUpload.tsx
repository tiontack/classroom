import React, { useCallback } from 'react';
import { Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SAMPLE_RESERVATIONS } from '../utils/sampleData';
import { format } from 'date-fns';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const downloadTemplate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const headers = [
      '예약 아이디', '건물', '층', '회의실', '회의실타입', '제목', 
      '부서', '사용자명', '전화번호', '시작일', '시작시간', 
      '종료시간', '생성일', '상태'
    ];
    
    // Convert sample data to Excel format
    const data = SAMPLE_RESERVATIONS.map(res => [
      res.id,
      res.building,
      res.floor,
      res.room,
      res.roomType,
      res.title,
      res.department,
      res.userName,
      res.phone,
      format(res.start, 'yyyy-MM-dd'),
      format(res.start, 'yyyy-MM-dd HH:mm:ss'),
      format(res.end, 'yyyy-MM-dd HH:mm:ss'),
      format(res.created, 'yyyy-MM-dd'),
      res.status
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    
    // Auto-adjust column widths (approximate)
    const wscols = headers.map(h => ({ wch: h.length + 10 }));
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "예약현황");
    XLSX.writeFile(wb, "강의장_예약_샘플.xlsx");
  };

  return (
    <div 
      className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer bg-white relative group"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => document.getElementById('fileInput')?.click()}
    >
      <input 
        type="file" 
        id="fileInput" 
        className="hidden" 
        accept=".xlsx, .xls" 
        onChange={handleFileChange}
      />
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
          <Upload className="w-8 h-8 text-blue-500" />
        </div>
        <div>
          <p className="text-lg font-medium text-gray-700">
            클릭하여 업로드하거나 파일을 드래그하세요
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Excel 파일 (.xlsx, .xls)만 지원됩니다
          </p>
        </div>
      </div>

      <button
        onClick={downloadTemplate}
        className="absolute bottom-4 right-4 flex items-center text-xs text-gray-400 hover:text-blue-600 transition-colors bg-white px-2 py-1 rounded border border-gray-200 hover:border-blue-300 shadow-sm"
      >
        <Download className="w-3 h-3 mr-1" />
        샘플 파일 다운로드
      </button>
    </div>
  );
};
