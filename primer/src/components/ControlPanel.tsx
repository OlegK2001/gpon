import { Play, Pause, RotateCcw, Save, FolderOpen, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSimulatorStore } from '@/store/simulatorStore';
import { toast } from 'sonner';

export const ControlPanel = () => {
  const { isRunning, isPaused, speedFactor, setRunning, setPaused, setSpeedFactor, reset, saveState, loadState } =
    useSimulatorStore();

  const handleStart = () => {
    setRunning(true);
    setPaused(false);
    toast.success('Simulation started');
  };

  const handlePause = () => {
    setPaused(!isPaused);
    toast.info(isPaused ? 'Simulation resumed' : 'Simulation paused');
  };

  const handleReset = () => {
    reset();
    toast.info('Simulation reset');
  };

  const handleSave = () => {
    const state = saveState();
    localStorage.setItem('gpon-simulator-state', state);
    
    const blob = new Blob([state], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gpon-simulation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('State saved successfully');
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        loadState(content);
        toast.success('State loaded successfully');
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const speedOptions = [0.5, 1, 2, 4];
  const cycleSpeed = () => {
    const currentIndex = speedOptions.indexOf(speedFactor);
    const nextIndex = (currentIndex + 1) % speedOptions.length;
    setSpeedFactor(speedOptions[nextIndex]);
    toast.info(`Speed: ${speedOptions[nextIndex]}x`);
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-card border-b border-border">
      <div className="flex items-center gap-2">
        {!isRunning ? (
          <Button onClick={handleStart} size="sm" className="gap-2">
            <Play className="w-4 h-4" />
            Start
          </Button>
        ) : (
          <Button onClick={handlePause} size="sm" variant="secondary" className="gap-2">
            <Pause className="w-4 h-4" />
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
        )}
        <Button onClick={handleReset} size="sm" variant="destructive" className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      <div className="h-6 w-px bg-border mx-2" />

      <Button onClick={cycleSpeed} size="sm" variant="outline" className="gap-2">
        <Gauge className="w-4 h-4" />
        Speed: {speedFactor}x
      </Button>

      <div className="h-6 w-px bg-border mx-2" />

      <Button onClick={handleSave} size="sm" variant="outline" className="gap-2">
        <Save className="w-4 h-4" />
        Save
      </Button>
      <Button onClick={handleLoad} size="sm" variant="outline" className="gap-2">
        <FolderOpen className="w-4 h-4" />
        Load
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-md">
          <div className={`w-2 h-2 rounded-full ${isRunning && !isPaused ? 'bg-success animate-pulse' : 'bg-muted'}`} />
          <span className="text-sm font-medium">
            {isRunning && !isPaused ? 'Running' : isPaused ? 'Paused' : 'Stopped'}
          </span>
        </div>
      </div>
    </div>
  );
};
