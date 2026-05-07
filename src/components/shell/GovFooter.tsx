export function GovFooter() {
  return (
    <footer className="border-t bg-white/60 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm sm:grid-cols-3 sm:px-6">
        <div>
          <div className="font-semibold">SISPAA Intelligent GovTech Router</div>
          <div className="mt-2 text-muted-foreground">
            Prototype for AI-assisted complaint coordination across agencies, workforce, SLA monitoring, and escalation.
          </div>
        </div>
        <div>
          <div className="font-semibold">Contact</div>
          <div className="mt-2 text-muted-foreground">
            Helpdesk: <span className="font-medium text-foreground">03-0000 0000</span>
          </div>
          <div className="mt-1 text-muted-foreground">
            Email: <span className="font-medium text-foreground">support@sispaa.gov.my</span>
          </div>
        </div>
        <div>
          <div className="font-semibold">Notice</div>
          <div className="mt-2 text-muted-foreground">
            © {new Date().getFullYear()} Government of Malaysia. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

