import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { fetchOverviewReport, type UserTimeReport } from '@/api/reports';

interface TeamMemberItemProps {
  member: UserTimeReport;
}

function TeamMemberItem({ member }: TeamMemberItemProps) {
  const { full_name, first_name, last_name, task_count, total_hours, avatar_url } = member as any;
  const initial1 = first_name?.[0] || full_name?.[0] || '';
  const initial2 = last_name?.[0] || '';
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="relative">
        <Avatar className="w-10 h-10">
          <AvatarImage src={avatar_url} />
          <AvatarFallback className="bg-blue-600 text-white text-sm">
            {initial1}{initial2}
          </AvatarFallback>
        </Avatar>
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-green-500"
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">
          {full_name}
        </p>
        <p className="text-sm text-gray-500">{task_count} tasks assigned</p>
      </div>
      
      <div className="text-right">
        <div className="flex items-center gap-3 text-sm justify-end">
          <div className="flex items-center gap-1">
            <span className="text-gray-600 font-medium">{total_hours}h</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">logged total</p>
      </div>
    </div>
  );
}

export function TeamWidget() {
  const [teamWorkload, setTeamWorkload] = useState<UserTimeReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTeam() {
      try {
        const data = await fetchOverviewReport();
        setTeamWorkload(data.top_contributors || []);
      } catch (err) {
        console.error('Failed to load team workload', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTeam();
  }, []);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-lg font-semibold">Top Contributors</CardTitle>
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {isLoading ? (
            <div className="text-center text-sm text-gray-500 py-4">Loading top team members...</div>
          ) : teamWorkload.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-4">No team activity found</div>
          ) : (
            teamWorkload.slice(0, 4).map((member) => (
              <TeamMemberItem key={member.user_id} member={member} />
            ))
          )}
        </div>

        <Button variant="ghost" className="w-full mt-4 text-blue-600 hover:text-blue-700" asChild>
          <Link to="/team">View team details</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

