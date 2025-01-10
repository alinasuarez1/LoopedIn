import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLocation } from "wouter";

interface Loop {
  id: number;
  name: string;
  frequency: string;
  creator?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  memberCount: number;
  lastNewsletter: string | null;
  createdAt: string;
  updateCount: number;
}

interface Stats {
  totalLoops: number;
  totalMembers: number;
  loopGrowth: Array<{
    date: string;
    count: number;
  }>;
  memberGrowth: Array<{
    date: string;
    count: number;
  }>;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  // Debounce search to avoid too many API calls
  const debouncedSearch = useDebounce(search, 300);

  const { data: loops, isLoading: isLoopsLoading, error: loopsError } = useQuery<Loop[]>({
    queryKey: ["/api/admin/loops", { search: debouncedSearch, sort: sortBy }],
    retry: false,
  });

  const { data: stats, isLoading: isStatsLoading, error: statsError } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });

  if (loopsError || statsError) {
    return (
      <div className="container mx-auto p-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{(loopsError || statsError)?.message || "Failed to load admin dashboard"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoopsLoading || isStatsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLoopClick = (loopId: number) => {
    setLocation(`/admin/loops/${loopId}`);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Loops</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalLoops || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalMembers || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {loops?.reduce((sum, loop) => sum + (loop.updateCount || 0), 0) || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Loop Growth</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.loopGrowth || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Member Growth</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.memberGrowth || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Loops Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Loops</CardTitle>
          <CardDescription>Manage all loops across the platform</CardDescription>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search loops..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="name">Loop Name</SelectItem>
                <SelectItem value="members">Member Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loop Name</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Last Newsletter</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loops?.map((loop) => (
                <TableRow 
                  key={loop.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleLoopClick(loop.id)}
                >
                  <TableCell className="font-medium">{loop.name}</TableCell>
                  <TableCell>
                    {loop.creator?.firstName} {loop.creator?.lastName}
                    <br />
                    <span className="text-sm text-muted-foreground">
                      {loop.creator?.email}
                    </span>
                  </TableCell>
                  <TableCell>{loop.memberCount}</TableCell>
                  <TableCell className="capitalize">{loop.frequency}</TableCell>
                  <TableCell>
                    {loop.lastNewsletter
                      ? new Date(loop.lastNewsletter).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    {new Date(loop.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Custom hook for debouncing values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}