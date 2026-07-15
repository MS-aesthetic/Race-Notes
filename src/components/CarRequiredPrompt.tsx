import EmptyState from './ui/EmptyState';

interface CarRequiredPromptProps {
  onAddCar: () => void;
  className?: string;
}

export default function CarRequiredPrompt({ onAddCar, className = '' }: CarRequiredPromptProps) {
  return (
    <section className={`overflow-hidden rounded-xl border-2 border-primary/50 bg-surface-container ${className}`}>
      <EmptyState
        icon="directions_car"
        title="Add a car first"
        body="Race Days, runs, setups, tires, and load sessions need a car."
        cta={{ label: 'Add a Car', icon: 'add', onClick: onAddCar }}
      />
    </section>
  );
}
