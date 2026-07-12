export default function PageShell({ title, children, action }) {
  return (
    <section className="material-page h-full flex flex-col overflow-hidden">
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 pb-4">
          {title && <h1 className="text-3xl font-medium text-md-primary">{title}</h1>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
