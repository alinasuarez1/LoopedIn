import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface Newsletter {
  id: number;
  content: string;
  status: 'draft' | 'sent';
  urlId: string;
  sentAt: string | null;
  loopId: number;
}

export default function NewsletterEditor() {
  const { loopId, newsletterId } = useParams<{ loopId: string, newsletterId: string }>();
  const { toast } = useToast();
  const [content, setContent] = useState("");

  // Fetch newsletter data
  const { data: newsletter, isLoading } = useQuery<Newsletter>({
    queryKey: [`/api/loops/${loopId}/newsletters/${newsletterId}/preview`],
  });

  // Set content when newsletter data is loaded
  useEffect(() => {
    if (newsletter?.content) {
      setContent(newsletter.content);
    }
  }, [newsletter]);

  // Update newsletter content
  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/loops/${loopId}/newsletters/${newsletterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Changes saved",
        description: "Newsletter draft has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save changes",
        variant: "destructive",
      });
    },
  });

  // Send newsletter to all members
  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/loops/${loopId}/newsletters/${newsletterId}/send`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Newsletter sent",
        description: "The newsletter has been sent to all loop members.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send newsletter",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!newsletter) {
    return (
      <div className="container mx-auto p-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Newsletter not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Edit Newsletter Draft</CardTitle>
          <CardDescription>
            Make changes to the newsletter before sending it to loop members
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 mb-4">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(`/newsletters/${newsletter.urlId}`, '_blank')}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button
              variant="default"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send to Members
                </>
              )}
            </Button>
          </div>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[500px] font-mono"
          />
        </CardContent>
      </Card>
    </div>
  );
}