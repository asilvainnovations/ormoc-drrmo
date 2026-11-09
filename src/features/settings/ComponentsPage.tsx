// Interface components (1.11.0): every component in src/components/ui working live, with what it does and where
// MODE uses it. The City's design tokens style all of them (a codemod mapped the kit's shadcn names to the tokens:
// primary → action, muted-foreground → muted, accent → sky-soft, destructive → bad, border/input → line,
// ring → focus), so light and dark follow tokens.css and stay within the WCAG AA pairs checked there.
// Reached from Settings → Interface components. Nothing here writes City data.
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Bell, Bold, BookOpen, Calendar as CalendarIcon, ChevronsUpDown, Italic, ListChecks, MoreHorizontal, RadioTower, Underline } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { PageHeader } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import { fmtLongDate } from '@/lib/time';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import GlassCard from '@/components/ui/GlassCard';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { IconAlert, IconMap, IconRadio, IconShield, IconSync, IconWifi } from '@/components/ui/icons';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from '@/components/ui/menubar';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuList, NavigationMenuTrigger } from '@/components/ui/navigation-menu';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar, SidebarHeader, SidebarNav, SidebarNavItem, SidebarSection, SidebarSectionTitle } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { toast as sonner } from '@/components/ui/sonner';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toaster as RadixToaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Entry { name: string; file: string; does: string; used: string; demo: ReactNode }

const chartConfig = { done: { label: 'Steps done', color: 'rgb(var(--sky))' }, open: { label: 'Steps open', color: 'rgb(var(--accent))' } } satisfies ChartConfig;
const chartRows = [{ day: 'Mon', done: 12, open: 4 }, { day: 'Tue', done: 18, open: 3 }, { day: 'Wed', done: 9, open: 6 }, { day: 'Thu', done: 15, open: 2 }];

function FormDemo() {
  const form = useForm<{ office: string }>({ defaultValues: { office: '' } });
  const [sent, setSent] = useState<string | null>(null);
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => setSent(v.office))} className="max-w-sm space-y-3">
        <FormField control={form.control} name="office" rules={{ required: 'Name the office, not a person.' }} render={({ field }) => (
          <FormItem>
            <FormLabel>Process owner</FormLabel>
            <FormControl><Input placeholder="e.g. CSWDO" {...field} {...tip('An office or position, never a person (RA 10173)')} /></FormControl>
            <FormDescription>Validation runs in the browser; messages are linked to the field for screen readers.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" {...tip('Check the field (nothing is saved)')}>Check</Button>
        {sent && <p className="text-sm text-ok">Valid: {sent}</p>}
      </form>
    </Form>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" {...tip('Show a Radix toast with an action button')} onClick={() => toast({ title: 'SitRep 4 approved', description: 'Sent to DILG VIII and OCD VIII.' })}>Radix toast</Button>
      <Button variant="outline" {...tip('Show a Sonner toast (top of the screen)')} onClick={() => sonner.success('Logbook entry saved on this device', { description: 'It sends when there is a connection.' })}>Sonner toast</Button>
      <RadixToaster />
    </div>
  );
}

export function ComponentsPage() {
  const [day, setDay] = useState<Date | undefined>(new Date());
  const [level, setLevel] = useState<number[]>([60]);
  const [otp, setOtp] = useState('');
  const [open, setOpen] = useState(false);
  const entries: Entry[] = [
    { name: 'Accordion', file: 'accordion.tsx', does: 'Stacked sections that open one or several at a time.', used: 'Public FAQ.', demo:
      <Accordion type="single" collapsible className="max-w-md"><AccordionItem value="a"><AccordionTrigger {...tip('Show or hide')}>When is the EOC activated?</AccordionTrigger><AccordionContent>When the approved trigger in the EOC EO or contingency plan is met (SOP 4-04).</AccordionContent></AccordionItem></Accordion> },
    { name: 'Alert', file: 'alert.tsx', does: 'A notice with a title and text; variants info, success, warning, destructive in City status colours.', used: 'Public pages (draft policies, "not an emergency channel").', demo:
      <Alert variant="warning" className="max-w-md"><IconAlert className="h-4 w-4" /><AlertTitle>Draft</AlertTitle><AlertDescription>For validation before approval.</AlertDescription></Alert> },
    { name: 'Alert dialog', file: 'alert-dialog.tsx', does: 'A confirmation that must be answered before continuing.', used: 'Available for irreversible steps (for example, discarding unsent entries).', demo:
      <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" {...tip('Open a confirmation (nothing happens)')}>Discard drafts…</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard the drafts?</AlertDialogTitle><AlertDialogDescription>This is a demonstration; nothing is deleted.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel {...tip('Keep them')}>Keep</AlertDialogCancel><AlertDialogAction {...tip('Close the demonstration')}>Discard</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> },
    { name: 'Aspect ratio', file: 'aspect-ratio.tsx', does: 'Keeps a box at a fixed shape while it scales.', used: 'Available for map previews and figures.', demo:
      <div className="w-60"><AspectRatio ratio={16 / 9} className="flex items-center justify-center rounded-control bg-sky-soft text-sm font-semibold">16 : 9</AspectRatio></div> },
    { name: 'Avatar', file: 'avatar.tsx', does: 'A round image with initials when there is no picture.', used: 'Available for account lists (initials only, no photos of people are collected).', demo:
      <div className="flex gap-2"><Avatar><AvatarFallback>DO</AvatarFallback></Avatar><Avatar><AvatarFallback>EM</AvatarFallback></Avatar></div> },
    { name: 'Badge', file: 'badge.tsx', does: 'A short label; variants default, secondary, outline, success, warning, info, destructive.', used: 'Command palette (Draft), public hero, SOP codes in the DRRM lists, error reports.', demo:
      <div className="flex flex-wrap gap-2"><Badge>Approved</Badge><Badge variant="secondary">Workflow</Badge><Badge variant="outline">SOP 4-06</Badge><Badge variant="success">Done</Badge><Badge variant="warning">Draft</Badge><Badge variant="info">Info</Badge><Badge variant="destructive">Critical</Badge></div> },
    { name: 'Breadcrumb', file: 'breadcrumb.tsx', does: 'Shows where a page sits and links back up.', used: 'Library documents, policy pages.', demo:
      <Breadcrumb><BreadcrumbList><BreadcrumbItem>Library</BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbEllipsis /></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>SOP 4-06</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb> },
    { name: 'Button', file: 'button.tsx', does: 'Variants default, secondary, outline, ghost, link, destructive; sizes sm, default, lg, icon.', used: 'Gallery, error reports; the app\'s own Button in ui.tsx stays the default for screens.', demo:
      <div className="flex flex-wrap gap-2"><Button {...tip('Primary action')}>Save</Button><Button variant="secondary" {...tip('Secondary action')}>Cancel</Button><Button variant="outline" {...tip('Outline button')}>Export</Button><Button variant="ghost" {...tip('Quiet button')}>More</Button><Button variant="link" {...tip('Link-style button')}>Read the SOP</Button></div> },
    { name: 'Calendar', file: 'calendar.tsx', does: 'Pick a date (react-day-picker).', used: 'Available for target dates in action plans.', demo:
      <Popover><PopoverTrigger asChild><Button variant="outline" {...tip('Pick a date')}><CalendarIcon className="mr-2 h-4 w-4" />{day ? fmtLongDate(day) : 'Pick a date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={day} onSelect={setDay} /></PopoverContent></Popover> },
    { name: 'Card', file: 'card.tsx', does: 'A surface with header, content and footer.', used: 'Today, public pages, DRRM summary, support.', demo:
      <Card className="max-w-sm"><CardHeader><CardTitle>SOP 4-08</CardTitle><CardDescription>SitRep, briefing and submission</CardDescription></CardHeader><CardContent className="text-sm">Cut-offs follow the DILG VIII reporting SOP.</CardContent><CardFooter><Badge variant="warning">Draft</Badge></CardFooter></Card> },
    { name: 'Carousel', file: 'carousel.tsx', does: 'Swipe through panels (Embla); arrows and keys work.', used: 'Available for figure walk-throughs.', demo:
      <Carousel className="mx-12 max-w-xs"><CarouselContent>{['White: normal', 'Blue: partial', 'Red: full'].map((t) => <CarouselItem key={t}><div className="flex h-24 items-center justify-center rounded-control border bg-surface font-semibold">{t}</div></CarouselItem>)}</CarouselContent><CarouselPrevious {...tip('Previous')} /><CarouselNext {...tip('Next')} /></Carousel> },
    { name: 'Chart', file: 'chart.tsx', does: 'Recharts with City colours, tooltip and legend.', used: 'Assessment → Results → Profile (radar).', demo:
      <ChartContainer config={chartConfig} className="h-48 w-full max-w-md"><BarChart data={chartRows}><CartesianGrid vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} /><Bar dataKey="done" fill="var(--color-done)" radius={4} /><Bar dataKey="open" fill="var(--color-open)" radius={4} /></BarChart></ChartContainer> },
    { name: 'Checkbox', file: 'checkbox.tsx', does: 'A tick box (Radix).', used: 'Available; forms use the app Checkbox.', demo:
      <div className="flex items-center gap-2"><Checkbox id="g-cb" {...tip('Tick or untick')} /><Label htmlFor="g-cb">This is a drill</Label></div> },
    { name: 'Collapsible', file: 'collapsible.tsx', does: 'Hide or show one block.', used: 'Error reports (technical details).', demo:
      <Collapsible className="max-w-sm"><CollapsibleTrigger asChild><Button variant="ghost" size="sm" {...tip('Show or hide')}><ChevronsUpDown className="mr-1 h-4 w-4" />Legal basis</Button></CollapsibleTrigger><CollapsibleContent className="text-sm text-muted">RA 10121 Sec. 12; NDRRMC Memo 131 s. 2018.</CollapsibleContent></Collapsible> },
    { name: 'Command', file: 'command.tsx', does: 'Searchable list (cmdk); also a dialog.', used: 'Search palette (Ctrl+K) on every workspace screen.', demo:
      <Command className="max-w-sm rounded-control border"><CommandInput placeholder="Find a protocol…" /><CommandList><CommandEmpty>Nothing found.</CommandEmpty><CommandGroup heading="Protocols"><CommandItem><ListChecks className="mr-2" />Warning receipt</CommandItem><CommandItem><RadioTower className="mr-2" />EOC activation</CommandItem></CommandGroup></CommandList></Command> },
    { name: 'Context menu', file: 'context-menu.tsx', does: 'Menu on right-click or long press.', used: 'Available for power users on tables.', demo:
      <ContextMenu><ContextMenuTrigger {...tip('Right-click or long-press here')} className="flex h-16 w-60 items-center justify-center rounded-control border border-dashed text-sm">Right-click or long-press</ContextMenuTrigger><ContextMenuContent><ContextMenuItem>Open</ContextMenuItem><ContextMenuItem>Copy code</ContextMenuItem></ContextMenuContent></ContextMenu> },
    { name: 'Dialog', file: 'dialog.tsx', does: 'A modal window with title and actions.', used: 'Search palette; available for confirmations.', demo:
      <Dialog><DialogTrigger asChild><Button variant="outline" {...tip('Open a dialog')}>Open dialog</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Activation recommendation</DialogTitle><DialogDescription>Demonstration only.</DialogDescription></DialogHeader><DialogFooter><Button {...tip('Close')} onClick={() => undefined}>OK</Button></DialogFooter></DialogContent></Dialog> },
    { name: 'Drawer', file: 'drawer.tsx', does: 'A bottom sheet that can be dragged (Vaul); good on phones.', used: 'Available; the app Sheet remains the default.', demo:
      <Drawer><DrawerTrigger asChild><Button variant="outline" {...tip('Open a drawer from the bottom')}>Open drawer</Button></DrawerTrigger><DrawerContent><DrawerHeader><DrawerTitle>Quick log entry</DrawerTitle><DrawerDescription>Drag down to close.</DrawerDescription></DrawerHeader><DrawerFooter><DrawerClose asChild><Button variant="outline" {...tip('Close')}>Close</Button></DrawerClose></DrawerFooter></DrawerContent></Drawer> },
    { name: 'Dropdown menu', file: 'dropdown-menu.tsx', does: 'A menu from a button.', used: 'Appearance switch, public menu on phones.', demo:
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" {...tip('Open a menu')}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuLabel>Run</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem>Start</DropdownMenuItem><DropdownMenuItem>Start as drill</DropdownMenuItem></DropdownMenuContent></DropdownMenu> },
    { name: 'Form', file: 'form.tsx', does: 'react-hook-form fields with labels, descriptions and messages wired for screen readers.', used: 'Available for new forms; step forms use the schema-driven renderer.', demo: <FormDemo /> },
    { name: 'Glass card', file: 'GlassCard.tsx', does: 'A translucent surface over the banner, in City tokens.', used: 'Today header.', demo:
      <GlassCard className="max-w-sm p-4"><p className="font-semibold">EOC White level</p><p className="text-sm text-muted">Normal operations</p></GlassCard> },
    { name: 'Hover card', file: 'hover-card.tsx', does: 'A preview on hover or focus.', used: 'DRRM step forms (preview the form).', demo:
      <HoverCard><HoverCardTrigger asChild><Button variant="link" {...tip('Hover or focus to preview')}>Form ER-F01</Button></HoverCardTrigger><HoverCardContent className="text-sm">Evacuation coordination and monitoring sheet: aggregate counts only.</HoverCardContent></HoverCard> },
    { name: 'Icons', file: 'icons.tsx', does: '33 line icons that inherit the text colour.', used: 'Gallery; Lucide icons remain the main set.', demo:
      <div className="flex gap-3 text-action">{[IconShield, IconMap, IconRadio, IconSync, IconWifi, IconAlert].map((I, i) => <I key={i} className="h-6 w-6" />)}</div> },
    { name: 'Input OTP', file: 'input-otp.tsx', does: 'One-time code boxes.', used: 'Available if one-time codes are added to sign-in.', demo:
      <InputOTP maxLength={6} value={otp} onChange={setOtp} {...tip('Type a six-digit code')}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /></InputOTPGroup><InputOTPSeparator /><InputOTPGroup><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup></InputOTP> },
    { name: 'Input, label, textarea', file: 'input.tsx, label.tsx, textarea.tsx', does: 'Text fields with accessible labels.', used: 'DRRM find field; the app Field stays the default.', demo:
      <div className="grid max-w-sm gap-2"><Label htmlFor="g-in">Barangay</Label><Input id="g-in" placeholder="e.g. Liloan" {...tip('Type a barangay name')} /><Textarea placeholder="Remarks (no names of affected people)" {...tip('Type remarks')} /></div> },
    { name: 'Menubar', file: 'menubar.tsx', does: 'A desktop menu bar.', used: 'Available for document editing tools.', demo:
      <Menubar className="w-fit"><MenubarMenu><MenubarTrigger {...tip('Open the File menu')}>File</MenubarTrigger><MenubarContent><MenubarItem>Export PDF</MenubarItem><MenubarSeparator /><MenubarItem>Print</MenubarItem></MenubarContent></MenubarMenu></Menubar> },
    { name: 'Navigation menu', file: 'navigation-menu.tsx', does: 'Site navigation with panels.', used: 'Available for a larger public site.', demo:
      <NavigationMenu><NavigationMenuList><NavigationMenuItem><NavigationMenuTrigger {...tip('Open the Manual menu')}>Manual</NavigationMenuTrigger><NavigationMenuContent><ul className="grid w-64 gap-1 p-3 text-sm"><li>Chapter 3: Risk information</li><li>Chapter 4: Early warning and response</li></ul></NavigationMenuContent></NavigationMenuItem></NavigationMenuList></NavigationMenu> },
    { name: 'Pagination', file: 'pagination.tsx', does: 'Page links for long lists.', used: 'Available for long registers.', demo:
      <Pagination className="justify-start"><PaginationContent><PaginationItem><PaginationPrevious href="#" {...tip('Previous page')} /></PaginationItem><PaginationItem><PaginationLink href="#" isActive {...tip('Page 1')}>1</PaginationLink></PaginationItem><PaginationItem><PaginationLink href="#" {...tip('Page 2')}>2</PaginationLink></PaginationItem><PaginationItem><PaginationNext href="#" {...tip('Next page')} /></PaginationItem></PaginationContent></Pagination> },
    { name: 'Popover', file: 'popover.tsx', does: 'A small panel attached to a button.', used: 'Calendar picker (above).', demo:
      <Popover><PopoverTrigger asChild><Button variant="outline" {...tip('Open a popover')}><Bell className="mr-2 h-4 w-4" />Next deadline</Button></PopoverTrigger><PopoverContent className="text-sm">RDRRMC reply due within 24 hours of the request.</PopoverContent></Popover> },
    { name: 'Progress', file: 'progress.tsx', does: 'A bar for completion; variants default, success, warning, error.', used: 'Today (assessment, Manual readiness).', demo:
      <div className="grid max-w-sm gap-2"><Progress value={42} aria-label="Demo progress" /><Progress value={100} variant="success" aria-label="Demo complete" /></div> },
    { name: 'Radio group', file: 'radio-group.tsx', does: 'One choice from a few.', used: 'Available for decision forms.', demo:
      <RadioGroup defaultValue="monitor" className="gap-2">{['monitor', 'act early', 'request declaration'].map((v) => <div key={v} className="flex items-center gap-2"><RadioGroupItem value={v} id={`g-r-${v}`} {...tip(`Choose: ${v}`)} /><Label htmlFor={`g-r-${v}`}>{v}</Label></div>)}</RadioGroup> },
    { name: 'Resizable', file: 'resizable.tsx', does: 'Panels the person can resize by dragging.', used: 'Available for side-by-side document review.', demo:
      <ResizablePanelGroup direction="horizontal" className="h-24 max-w-md rounded-control border"><ResizablePanel defaultSize={50}><div className="p-3 text-sm">Draft v1.0</div></ResizablePanel><ResizableHandle withHandle {...tip('Drag to resize')} /><ResizablePanel defaultSize={50}><div className="p-3 text-sm">Draft v1.1</div></ResizablePanel></ResizablePanelGroup> },
    { name: 'Scroll area', file: 'scroll-area.tsx', does: 'A scrolling box with a styled bar.', used: 'Available for long lists in panels.', demo:
      <ScrollArea className="h-24 w-60 rounded-control border p-2 text-sm">{Array.from({ length: 12 }, (_, i) => <p key={i}>Barangay {i + 1}</p>)}</ScrollArea> },
    { name: 'Select', file: 'select.tsx', does: 'A styled choice list (Radix).', used: 'Available; the app Select stays the default for forms.', demo:
      <Select><SelectTrigger className="w-60" {...tip('Choose a hazard')}><SelectValue placeholder="Hazard" /></SelectTrigger><SelectContent><SelectItem value="tc">Tropical cyclone</SelectItem><SelectItem value="ff">Flash flood</SelectItem><SelectItem value="eq">Earthquake</SelectItem></SelectContent></Select> },
    { name: 'Separator', file: 'separator.tsx', does: 'A rule between groups.', used: 'Policy pages.', demo: <div className="max-w-sm"><p className="text-sm">Above</p><Separator className="my-2" /><p className="text-sm">Below</p></div> },
    { name: 'Sheet', file: 'sheet.tsx', does: 'A side panel (Radix dialog).', used: 'Available; the app Sheet (native dialog) remains for records.', demo:
      <Sheet><SheetTrigger asChild><Button variant="outline" {...tip('Open a side panel')}>Open sheet</Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>SOP control</SheetTitle><SheetDescription>Controlling SOP, owner, policy basis, indicators.</SheetDescription></SheetHeader></SheetContent></Sheet> },
    { name: 'Sidebar', file: 'sidebar.tsx', does: 'A navigation column with sections. (Its provider would set a "sidebar:state" cookie when toggled; MODE does not use the provider.)', used: 'Gallery; the workspace rail is the AppShell.', demo:
      <Sidebar className="h-auto rounded-control border"><SidebarHeader className="font-semibold">DRRM</SidebarHeader><SidebarSection><SidebarSectionTitle>Procedures</SidebarSectionTitle><SidebarNav><SidebarNavItem active><BookOpen className="mr-2 h-4 w-4" />Workflows</SidebarNavItem><SidebarNavItem><ListChecks className="mr-2 h-4 w-4" />Protocols</SidebarNavItem></SidebarNav></SidebarSection></Sidebar> },
    { name: 'Skeleton', file: 'skeleton.tsx', does: 'A placeholder while data loads.', used: 'Today, error reports.', demo: <div className="grid max-w-sm gap-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-1/2" /></div> },
    { name: 'Slider', file: 'slider.tsx', does: 'Pick a value by dragging.', used: 'Available for thresholds in exercises.', demo:
      <div className="max-w-sm"><Slider value={level} onValueChange={setLevel} max={100} step={5} aria-label="Demo value" {...tip('Drag to set a value')} /><p className="mt-2 text-sm">{level[0]}%</p></div> },
    { name: 'Sonner and toast', file: 'sonner.tsx, toast.tsx, toaster.tsx, use-toast.ts', does: 'Short messages after an action. Sonner is mounted app-wide; the Radix toast supports an action button.', used: 'App-wide Sonner; components/Toast still echoes everyday verbs.', demo: <ToastDemo /> },
    { name: 'Switch', file: 'switch.tsx', does: 'An on/off control.', used: 'Available for settings.', demo:
      <div className="flex items-center gap-2"><Switch id="g-sw" checked={open} onCheckedChange={setOpen} {...tip('Turn on or off')} /><Label htmlFor="g-sw">Notify me of level changes</Label></div> },
    { name: 'Table', file: 'table.tsx', does: 'A data table with caption, header and rows.', used: 'Error reports.', demo:
      <Table className="max-w-md"><TableCaption>EOC levels</TableCaption><TableHeader><TableRow><TableHead>Level</TableHead><TableHead>Posture</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>White</TableCell><TableCell>Routine monitoring</TableCell></TableRow><TableRow><TableCell>Blue</TableCell><TableCell>Partial activation</TableCell></TableRow><TableRow><TableCell>Red</TableCell><TableCell>Full activation</TableCell></TableRow></TableBody></Table> },
    { name: 'Tabs', file: 'tabs.tsx', does: 'Switch between views of one thing.', used: 'DRRM template sheet (Steps, SOP control, When and who); assessment results (Bars, Profile).', demo:
      <Tabs defaultValue="a" className="max-w-sm"><TabsList><TabsTrigger value="a" {...tip('First view')}>Steps</TabsTrigger><TabsTrigger value="b" {...tip('Second view')}>Control</TabsTrigger></TabsList><TabsContent value="a" className="text-sm">Seven steps.</TabsContent><TabsContent value="b" className="text-sm">SOP 4-06.</TabsContent></Tabs> },
    { name: 'Toggle and toggle group', file: 'toggle.tsx, toggle-group.tsx', does: 'Pressed or not; one or several of a group.', used: 'Available for view filters.', demo:
      <div className="flex gap-3"><Toggle aria-label="Bold" {...tip('Bold')}><Bold className="h-4 w-4" /></Toggle><ToggleGroup type="multiple"><ToggleGroupItem value="i" aria-label="Italic" {...tip('Italic')}><Italic className="h-4 w-4" /></ToggleGroupItem><ToggleGroupItem value="u" aria-label="Underline" {...tip('Underline')}><Underline className="h-4 w-4" /></ToggleGroupItem></ToggleGroup></div> },
    { name: 'Tooltip (Radix)', file: 'tooltip.tsx', does: 'A Radix tooltip. MODE\'s own tooltip layer (data-tip) stays the standard: it also works on long press and is checked on every screen.', used: 'Gallery.', demo:
      <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="outline" {...tip('Radix tooltip demonstration')}>Hover me</Button></TooltipTrigger><TooltipContent>Radix tooltip</TooltipContent></Tooltip></TooltipProvider> },
    { name: 'Theme provider', file: 'theme-provider.tsx', does: 'Light, dark or device appearance, kept on the device.', used: 'Whole app; Appearance button in the rail, on Today and on public pages.', demo: <ThemeToggle withLabel /> },
  ];
  return (
    <div className="page">
      <PageHeader title="Interface components" back="/settings"
        subtitle={`${entries.length} entries covering the 51 files in src/components/ui and the theme provider. Each works below with City colours; nothing here saves City data.`} />
      <Accordion type="multiple" className="rounded-sheet border border-line bg-surface px-4">
        {entries.map((e) => (
          <AccordionItem key={e.name} value={e.name}>
            <AccordionTrigger {...tip(`Show ${e.name}: what it does, where MODE uses it, and a live example`)}>
              <span className="text-left"><span className="font-bold">{e.name}</span> <span className="font-data text-xs text-muted">{e.file}</span></span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p>{e.does}</p>
              <p className="text-sm text-muted"><span className="font-semibold text-ink">In MODE: </span>{e.used}</p>
              <div className="rounded-control border border-dashed border-line p-4">{e.demo}</div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
