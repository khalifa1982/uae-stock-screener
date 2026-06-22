/**
 * Earnings Transcripts Component
 * 
 * Features:
 * - Chapter and section headers
 * - Inline speaker info (CEO, CFO, analyst names with titles)
 * - Outline/table of contents sidebar to jump between sections
 * - Collapsible sections for easy reading
 * - Professional financial terminal styling
 */

import { useState, useRef, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, ChevronDown, ChevronRight, User, Mic, MessageSquare,
  Calendar, Clock, List, BookOpen, Search, ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
interface TranscriptSection {
  id: string;
  type: "header" | "speaker" | "text" | "qa-header";
  title?: string;
  speaker?: string;
  role?: string;
  company?: string;
  content: string;
  timestamp?: string;
}

interface TranscriptData {
  title: string;
  date: string;
  quarter: string;
  year: number;
  sections: TranscriptSection[];
  participants: { name: string; role: string; company: string }[];
}

// ─── Speaker Badge ────────────────────────────────────────────────
function SpeakerBadge({ name, role, company }: { name: string; role?: string; company?: string }) {
  const isExecutive = role && /CEO|CFO|COO|CTO|CIO|President|Chairman|Director|VP|Chief/i.test(role);
  const isAnalyst = role && /Analyst|Research|Portfolio/i.test(role);
  
  return (
    <div className="flex items-center gap-2 py-2">
      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
        isExecutive ? "bg-primary/20 text-primary" :
        isAnalyst ? "bg-chart-2/20 text-chart-2" :
        "bg-muted text-muted-foreground"
      }`}>
        {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-foreground">{name}</span>
          {role && (
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
              isExecutive ? "border-primary/30 text-primary" :
              isAnalyst ? "border-chart-2/30 text-chart-2" :
              "border-border/50 text-muted-foreground"
            }`}>
              {role}
            </Badge>
          )}
        </div>
        {company && <span className="text-[10px] text-muted-foreground">{company}</span>}
      </div>
    </div>
  );
}

// ─── Section Component ────────────────────────────────────────────
function TranscriptSectionView({ section, isActive, onClick }: {
  section: TranscriptSection;
  isActive: boolean;
  onClick: () => void;
}) {
  if (section.type === "header" || section.type === "qa-header") {
    return (
      <div
        id={section.id}
        className={`sticky top-0 z-10 py-2 px-3 cursor-pointer transition-colors ${
          section.type === "qa-header"
            ? "bg-chart-2/10 border border-chart-2/20"
            : "bg-primary/10 border border-primary/20"
        } ${isActive ? "ring-1 ring-primary/50" : ""}`}
        onClick={onClick}
      >
        <div className="flex items-center gap-2">
          {section.type === "qa-header" ? (
            <MessageSquare className="h-3.5 w-3.5 text-chart-2" />
          ) : (
            <BookOpen className="h-3.5 w-3.5 text-primary" />
          )}
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            {section.title || section.content}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div id={section.id} className={`py-1 ${isActive ? "bg-primary/5" : ""}`}>
      {section.speaker && (
        <SpeakerBadge name={section.speaker} role={section.role} company={section.company} />
      )}
      <div className="pl-9 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
        {section.content}
      </div>
    </div>
  );
}

// ─── Outline Sidebar ──────────────────────────────────────────────
function TranscriptOutline({ sections, activeSection, onNavigate }: {
  sections: TranscriptSection[];
  activeSection: string;
  onNavigate: (id: string) => void;
}) {
  const headers = sections.filter(s => s.type === "header" || s.type === "qa-header");

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <List className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Outline</span>
      </div>
      {headers.map((h) => (
        <button
          key={h.id}
          onClick={() => onNavigate(h.id)}
          className={`w-full text-left px-2 py-1.5 rounded text-[10px] transition-colors ${
            activeSection === h.id
              ? "bg-primary/15 text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
          }`}
        >
          <div className="flex items-center gap-1.5">
            {h.type === "qa-header" ? (
              <MessageSquare className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">{h.title || h.content}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export function EarningsTranscripts({ symbol, companyName }: { symbol: string; companyName?: string }) {
  const [activeSection, setActiveSection] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOutline, setShowOutline] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch transcript data
  const { data: transcriptData, isLoading } = trpc.stocks.earningsTranscript.useQuery(
    { symbol },
    { staleTime: 3600_000, gcTime: 7200_000, refetchOnWindowFocus: false }
  );

  const transcript = transcriptData as TranscriptData | null | undefined;

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!transcript?.sections) return [];
    if (!searchQuery) return transcript.sections;
    const q = searchQuery.toLowerCase();
    return transcript.sections.filter(s =>
      s.content.toLowerCase().includes(q) ||
      s.speaker?.toLowerCase().includes(q) ||
      s.title?.toLowerCase().includes(q)
    );
  }, [transcript, searchQuery]);

  const handleNavigate = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!transcript || !transcript.sections || transcript.sections.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No earnings transcript available for {companyName || symbol}.</p>
          <p className="text-xs text-muted-foreground mt-1">Transcripts are available for select stocks with analyst coverage.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {transcript.title}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {transcript.date}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">{transcript.quarter} {transcript.year}</Badge>
            <span className="flex items-center gap-1"><User className="h-3 w-3" /> {transcript.participants?.length || 0} participants</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-6 pl-6 pr-2 w-36 text-[10px] bg-background/50 border border-border/40 rounded focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={() => setShowOutline(!showOutline)}
          >
            <List className="h-3 w-3" />
            {showOutline ? "Hide" : "Show"} Outline
          </Button>
        </div>
      </div>

      {/* Participants */}
      {transcript.participants && transcript.participants.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="h-3 w-3" /> Call Participants
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {transcript.participants.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="text-muted-foreground">— {p.role}</span>
                  {p.company && <span className="text-muted-foreground/60">({p.company})</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content with Outline */}
      <div className="flex gap-3">
        {/* Outline Sidebar */}
        {showOutline && (
          <div className="w-48 shrink-0 hidden lg:block">
            <Card className="border-border/50 sticky top-2">
              <CardContent className="p-2">
                <ScrollArea className="h-[500px]">
                  <TranscriptOutline
                    sections={transcript.sections}
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                  />
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Transcript Content */}
        <div className="flex-1 min-w-0">
          <Card className="glass-card">
            <CardContent className="p-3">
              <ScrollArea className="h-[500px]">
                <div ref={contentRef} className="space-y-2 pr-2">
                  {filteredSections.map((section) => (
                    <TranscriptSectionView
                      key={section.id}
                      section={section}
                      isActive={activeSection === section.id}
                      onClick={() => setActiveSection(section.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
