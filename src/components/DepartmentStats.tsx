import React, { useState, useMemo } from 'react';
import { CalendarEvent } from '../types';
import { X, BarChart2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DepartmentStatsProps {
  events: CalendarEvent[];
  onClose: () => void;
}

export const DepartmentStats: React.FC<DepartmentStatsProps> = ({ events, onClose }) => {
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  // Calculate stats
  const stats = useMemo(() => {
    const deptStats: Record<string, { count: number; hours: number }> = {};

    events.forEach(event => {
      const dept = event.originalData.department || '미지정';
      if (!deptStats[dept]) {
        deptStats[dept] = { count: 0, hours: 0 };
      }
      
      deptStats[dept].count += 1;
      
      const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
      deptStats[dept].hours += duration;
    });

    return Object.entries(deptStats)
      .sort((a, b) => b[1].count - a[1].count); // Sort by count descending
  }, [events]);

  // Get events for selected department
  const deptEvents = useMemo(() => {
    if (!selectedDept) return [];
    return events
      .filter(event => (event.originalData.department || '미지정') === selectedDept)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [events, selectedDept]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            {selectedDept ? (
              <>
                <button 
                  onClick={() => setSelectedDept(null)}
                  className="mr-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {selectedDept} 예약 내역
              </>
            ) : (
              <>
                <BarChart2 className="w-5 h-5 mr-2" />
                부서별 예약 통계
              </>
            )}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {selectedDept ? (
            <div className="space-y-4">
               {/* Detail List */}
               {deptEvents.length > 0 ? (
                 <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">일자</th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">강의장</th>
                       <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">내용</th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {deptEvents.map((event, idx) => (
                       <tr key={idx} className="hover:bg-gray-50">
                         <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                           {format(event.start, 'yyyy-MM-dd (eee)', { locale: ko })}
                         </td>
                         <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                           {format(event.start, 'HH:mm')} ~ {format(event.end, 'HH:mm')}
                         </td>
                         <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                           {event.originalData.room}
                         </td>
                         <td className="px-4 py-3 text-sm text-gray-900">
                           {event.title}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               ) : (
                 <p className="text-center text-gray-500 py-4">예약 내역이 없습니다.</p>
               )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">부서명</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">예약 건수</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">총 사용 시간</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.length > 0 ? (
                  stats.map(([dept, data]) => (
                    <tr 
                      key={dept} 
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedDept(dept)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">{dept}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{data.count}건</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{data.hours.toFixed(1)}시간</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                      데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-4 border-t bg-gray-50 flex justify-end rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
