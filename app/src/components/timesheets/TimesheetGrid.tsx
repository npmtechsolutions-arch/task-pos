import { useState, useEffect } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle,
  Send
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useTimeStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function TimesheetGrid() {
  const { timesheets, fetchMyTimesheets, submitTimesheet } = useTimeStore();
  const { addToast } = useUIStore();
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);

  useEffect(() => {
    fetchMyTimesheets();
  }, [fetchMyTimesheets]);

  const currentSheet = timesheets[selectedSheetIndex];

  if (!currentSheet && timesheets.length === 0) {
    return (
      <Card className="bg-white/50 border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No timesheets yet</h3>
          <p className="text-sm text-gray-500 text-center max-w-xs mt-1">
            Log time on tasks to automatically generate your weekly timesheets.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handlePrev = () => {
    if (selectedSheetIndex < timesheets.length - 1) {
      setSelectedSheetIndex(selectedSheetIndex + 1);
    }
  };

  const handleNext = () => {
    if (selectedSheetIndex > 0) {
      setSelectedSheetIndex(selectedSheetIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!currentSheet) return;
    await submitTimesheet(currentSheet.id);
    addToast({ type: 'success', title: 'Timesheet submitted for approval' });
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700 border-gray-200',
    submitted: 'bg-blue-100 text-blue-700 border-blue-200',
    approved: 'bg-green-100 text-green-700 border-green-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-6">
      {currentSheet && (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-white rounded-lg border shadow-sm p-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrev} disabled={selectedSheetIndex >= timesheets.length - 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="px-3 flex items-center gap-2 text-sm font-medium border-x">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span>{formatDate(currentSheet.startDate, 'MMM d')} - {formatDate(currentSheet.endDate, 'MMM d, yyyy')}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNext} disabled={selectedSheetIndex === 0}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Badge variant="outline" className={cn("px-3 py-1 font-semibold", statusColors[currentSheet.status as keyof typeof statusColors])}>
                  {currentSheet.status.toUpperCase()}
                </Badge>
              </div>
              
              {currentSheet.status === 'draft' && (
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSubmit}>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Timesheet
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-3 divide-x border-b">
              <div className="p-4 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Hours</span>
                <span className="text-2xl font-bold text-gray-900">{currentSheet.totalHours.toFixed(1)}h</span>
              </div>
              <div className="p-4 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Billable</span>
                <span className="text-2xl font-bold text-blue-600">{currentSheet.billableHours.toFixed(1)}h</span>
              </div>
              <div className="p-4 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Utilization</span>
                <span className="text-2xl font-bold text-gray-900">{Math.min(100, (currentSheet.totalHours / 40) * 100).toFixed(0)}%</span>
              </div>
            </div>

            <Table>
              <TableHeader className="bg-gray-50/30">
                <TableRow>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Task / Project</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-center">Billable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {currentSheet.entries && currentSheet.entries.length > 0 ? currentSheet.entries.map((entry: any) => (
                   <TableRow key={entry.id}>
                     <TableCell className="font-medium text-gray-600">
                       {formatDate(entry.date, 'eee, MMM d')}
                     </TableCell>
                     <TableCell>
                       <div className="flex flex-col">
                         <span className="font-semibold text-gray-900 text-sm">Task #{entry.task_id.substring(0,8)}</span>
                         <span className="text-[10px] text-gray-400 uppercase">PRJ-{entry.project_id.substring(0,4)}</span>
                       </div>
                     </TableCell>
                     <TableCell className="text-sm text-gray-500 italic max-w-xs truncate">
                       {entry.description || 'No description provided'}
                     </TableCell>
                     <TableCell className="text-right font-bold text-gray-900">
                       {entry.hours.toFixed(1)}h
                     </TableCell>
                     <TableCell className="text-center">
                       {entry.isBillable ? (
                         <Badge className="bg-green-50 text-green-700 border-green-100 text-[10px]">YES</Badge>
                       ) : (
                         <Badge variant="outline" className="text-[10px]">NO</Badge>
                       )}
                     </TableCell>
                   </TableRow>
                 )) : (
                   <TableRow>
                     <TableCell colSpan={5} className="text-center py-12 text-gray-400 italic">
                        No time entries found for this period.
                     </TableCell>
                   </TableRow>
                 )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Stats Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm bg-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium opacity-90">Personal Productivity</CardTitle>
            <CardDescription className="text-blue-100">Your performance impact this week.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               <div className="flex items-center justify-between text-sm">
                 <span>Weekly Goal (40h)</span>
                 <span>{((currentSheet?.totalHours || 0) / 40 * 100).toFixed(0)}%</span>
               </div>
               <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                 <div className="h-full bg-white transition-all duration-700" style={{ width: `${Math.min(100, (currentSheet?.totalHours || 0) / 40 * 100)}%` }} />
               </div>
               <div className="flex items-center gap-2 pt-2">
                 <div className="flex -space-x-2">
                   {[1,2,3].map(i => (
                     <div key={i} className="h-8 w-8 rounded-full border-2 border-blue-600 bg-blue-100 flex items-center justify-center text-[10px] text-blue-600 font-bold">
                       {i}
                     </div>
                   ))}
                   <div className="h-8 w-8 rounded-full border-2 border-blue-600 bg-white/10 flex items-center justify-center text-[10px] text-white font-bold">
                     +
                   </div>
                 </div>
                 <span className="text-xs opacity-80">You've hit 85% of your target.</span>
               </div>
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-gray-900">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             {[1,2].map(i => (
               <div key={i} className="flex gap-3 items-start">
                 <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">Time record approved</p>
                    <p className="text-xs text-gray-500">Your log for PRJ-9032 was verified by Admin.</p>
                 </div>
                 <span className="text-[10px] text-gray-400 whitespace-nowrap">2h ago</span>
               </div>
             ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
