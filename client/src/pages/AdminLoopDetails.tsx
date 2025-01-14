import { useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
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
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { BulkSMSDialog } from "@/components/BulkSMSDialog";
import { type User, type Loop, type LoopMember, type Update, type Newsletter } from "@db/schema";

interface LoopDetails extends Loop {
  creator: {
    firstName: string;
    lastName: string;
    email: string;
  };
  members: Array<LoopMember & {
    user: User;
  }>;
  updates: Array<Update & {
    user: User;
  }>;
  newsletters: Newsletter[];
}

export default function AdminLoopDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: loop, isLoading, error } = useQuery<LoopDetails>({
    queryKey: [`/api/admin/loops/${id}`],
    retry: false,
  });

  const generateNewsletterMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/loops/${id}/newsletters/generate`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();

      if (!data.newsletter || !data.newsletter.id) {
        throw new Error("Invalid response format from server");
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Newsletter Generated",
        description: "The newsletter has been generated and saved as a draft.",
      });
      if (data.newsletter?.id) {
        setLocation(`/admin/loops/${id}/newsletters/${data.newsletter.id}`);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate newsletter",
        variant: "destructive",
      });
    },
  });

  const handleGenerateNewsletter = useCallback(() => {
    generateNewsletterMutation.mutate();
  }, [generateNewsletterMutation]);

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error instanceof Error ? error.message : "Failed to load loop details"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !loop) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{loop.name}</h1>
        <div className="flex gap-2">
          <BulkSMSDialog
            loopId={parseInt(id)}
            loopName={loop.name}
            memberCount={loop.members.length}
          />
          <Button
            onClick={handleGenerateNewsletter}
            disabled={generateNewsletterMutation.isPending}
          >
            {generateNewsletterMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Newsletter"
            )}
          </Button>
        </div>
      </div>

      {/* Loop Info */}
      <Card>
        <CardHeader>
          <CardTitle>Loop Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="font-medium text-muted-foreground">Frequency</dt>
              <dd className="capitalize">{loop.frequency}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Admin</dt>
              <dd>{loop.creator.firstName} {loop.creator.lastName} ({loop.creator.email})</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Vibe Tags</dt>
              <dd>{loop.vibe.join(", ")}</dd>
            </div>
            {loop.context && (
              <div>
                <dt className="font-medium text-muted-foreground">Context</dt>
                <dd>{loop.context}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>{loop.members.length} total members</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loop.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    {member.user.firstName} {member.user.lastName}
                    {member.nickname && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({member.nickname})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{member.user.email || "—"}</TableCell>
                  <TableCell>{member.user.phoneNumber}</TableCell>
                  <TableCell>{member.context || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Updates</CardTitle>
          <CardDescription>{loop.updates.length} total updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loop.updates.map((update) => (
            <Card key={update.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <p className="font-medium">
                    {update.user.firstName} {update.user.lastName}
                  </p>
                  <time className="text-sm text-muted-foreground">
                    {format(new Date(update.createdAt), "PPp")}
                  </time>
                </div>
              </CardHeader>
              <CardContent>
                <p>{update.content}</p>
                {update.mediaUrls && update.mediaUrls.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {update.mediaUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View Media {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Newsletters */}
      <Card>
        <CardHeader>
          <CardTitle>Past Newsletters</CardTitle>
          <CardDescription>
            {loop.newsletters.length} total newsletters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {loop.newsletters.map((newsletter) => (
              <div
                key={newsletter.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex flex-col">
                  <time className="text-sm text-muted-foreground">
                    {newsletter.sentAt ? format(new Date(newsletter.sentAt), "PPp") : "Not sent"}
                  </time>
                  <span className="text-xs text-muted-foreground mt-1">
                    Status: {newsletter.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {newsletter.status === "draft" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLocation(`/admin/loops/${id}/newsletters/${newsletter.id}`)
                      }
                    >
                      Edit Draft
                    </Button>
                  ) : (
                    <a
                      href={`/newsletters/${newsletter.urlId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      View Newsletter
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {loop.newsletters.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No newsletters have been generated yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}