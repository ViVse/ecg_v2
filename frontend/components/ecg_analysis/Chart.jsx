import React, { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import zoomPlugin from "chartjs-plugin-zoom";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Settings } from "lucide-react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";

// Register all necessary components
Chart.register(...registerables, annotationPlugin, zoomPlugin);

const MyChart = ({ data: tsData, predictions }) => {
  const chartRef = useRef();
  const [selectedLine, setSelectedLine] = useState();
  const [showP, setShowP] = useState(true);
  const [showQ, setShowQ] = useState(true);
  const [showS, setShowS] = useState(true);
  const [showT, setShowT] = useState(true);
  const [labeledData, setLabeledData] = useState([]);

  // Initial chart configuration
  useEffect(() => {
    if (typeof window === "undefined" || !tsData || !chartRef.current) return;

    const { ecg_clean, r_peaks, p_peaks, q_peaks, s_peaks, t_peaks } = tsData;

    const initialLabeledData = ecg_clean.map((value, index) => ({
      index: index,
      ecgValue: value,
      isRPeak: r_peaks[index] === 1,
      pPeak: p_peaks[index] === 1 ? value : null,
      qPeak: q_peaks[index] === 1 ? value : null,
      sPeak: s_peaks[index] === 1 ? value : null,
      tPeak: t_peaks[index] === 1 ? value : null,
    }));

    // Assign ordinal numbers to R peaks
    let ordinal = 0;
    initialLabeledData.forEach((d) => {
      if (d.isRPeak) {
        ordinal += 1;
        d.label = ordinal.toString(); // convert to string for labeling
      }
    });

    // use state to always use complete data
    // was causing problems when using single variable
    setLabeledData(initialLabeledData);

    const ctx = chartRef.current.getContext("2d");

    const chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: initialLabeledData.map((d) => d.index),
        datasets: [], // Initially empty, will be populated in updateDatasets
      },
      options: {
        responsive: true,
        animation: {
          duration: selectedLine ? 0 : 1000, // Disable animation on line click
        },
        scales: {
          x: {
            type: "linear",
            position: "bottom",
            display: false, // Hide X-axis labels
          },
          y: {
            type: "linear",
          },
        },
        plugins: {
          tooltip: {
            mode: "index",
            intersect: false,
          },
          annotation: {
            annotations: initialLabeledData
              .filter((d) => d.isRPeak)
              .map((d, idx) => ({
                type: "line",
                xMin: d.index,
                xMax: d.index,
                borderColor: "lightgray",
                borderWidth: 1,
                label: {
                  content: `R${idx + 1}`,
                  display: true,
                  position: "start",
                  yAdjust: -15,
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  color: "white",
                  padding: 6,
                  font: {
                    size: 10,
                  },
                },
                click: () => {
                  setSelectedLine(`R${idx + 1}`);
                },
                enter: () => {
                  document.body.style.cursor = "pointer";
                },
                leave: () => {
                  document.body.style.cursor = "default";
                },
              })),
          },
          zoom: {
            pan: {
              enabled: true,
              mode: "x",
            },
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true,
              },
              mode: "x",
            },
          },
        },
      },
    });

    updateDatasets(chartInstance, initialLabeledData);

    // Cleanup on component unmount
    return () => {
      chartInstance.destroy();
      document.body.style.cursor = "default";
    };
  }, [tsData]);

  // Creates array of data for Chart based on state
  const updateDatasets = (chartInstance, labeledData) => {
    const pointOptions = (color) => ({
      backgroundColor: color,
      borderWidth: 0,
      pointRadius: 5,
      showLine: false,
    });

    const datasets = [
      {
        label: "ECG",
        data: labeledData.map((d) => d.ecgValue),
        borderColor: "red",
        borderWidth: 1,
        fill: false,
        pointRadius: 0,
      },
    ];

    if (showP) {
      datasets.push({
        label: "P Peaks",
        data: labeledData
          .filter((d) => d.pPeak !== null)
          .map((d) => ({ x: d.index, y: d.pPeak })),
        ...pointOptions("blue"),
      });
    }

    if (showQ) {
      datasets.push({
        label: "Q Peaks",
        data: labeledData
          .filter((d) => d.qPeak !== null)
          .map((d) => ({ x: d.index, y: d.qPeak })),
        ...pointOptions("red"),
      });
    }

    if (showS) {
      datasets.push({
        label: "S Peaks",
        data: labeledData
          .filter((d) => d.sPeak !== null)
          .map((d) => ({ x: d.index, y: d.sPeak })),
        ...pointOptions("green"),
      });
    }

    if (showT) {
      datasets.push({
        label: "T Peaks",
        data: labeledData
          .filter((d) => d.tPeak !== null)
          .map((d) => ({ x: d.index, y: d.tPeak })),
        ...pointOptions("black"),
      });
    }

    chartInstance.data.datasets = datasets;
    chartInstance.update("none");
  };

  // handle toggling peak display
  useEffect(() => {
    if (!chartRef.current) return;

    const chartInstance = Chart.getChart(chartRef.current);

    // Preserve the current zoom state
    const zoomState = {
      x: chartInstance.scales.x.min,
      y: chartInstance.scales.x.max,
    };

    updateDatasets(chartInstance, labeledData);

    // Restore the zoom state
    chartInstance.scales.x.min = zoomState.x;
    chartInstance.scales.x.max = zoomState.y;
    chartInstance.update("none");
  }, [showP, showQ, showS, showT, labeledData]);

  // handle annotation(R peaks) color changes on select & prediction
  useEffect(() => {
    if (!chartRef.current) return;

    const chartInstance = Chart.getChart(chartRef.current);

    if (predictions) {
      for (
        let i = 0;
        i < chartInstance.options.plugins.annotation.annotations.length;
        i++
      ) {
        if (chartInstance.options.plugins.annotation.annotations[i].label) {
          chartInstance.options.plugins.annotation.annotations[i].borderColor =
            predictions[i].isNormal ? "green" : "red";
          chartInstance.options.plugins.annotation.annotations[
            i
          ].label.backgroundColor = predictions[i].isNormal ? "green" : "red";
        }
      }
      chartInstance.update("none");
      return;
    }

    // Update the annotation colors based on selected line
    chartInstance.options.plugins.annotation.annotations.forEach(
      (annotation) => {
        if (annotation.label) {
          annotation.borderColor =
            selectedLine === annotation.label.content ? "blue" : "lightgray";
          annotation.label.backgroundColor =
            selectedLine === annotation.label.content
              ? "blue"
              : "rgba(0, 0, 0, 0.5)";
        }
      }
    );

    chartInstance.update("none"); // Update without animation
  }, [selectedLine, predictions]);

  return (
    <div className="relative">
      <div className="absolute right-0 top-8">
        <Popover>
          <PopoverTrigger>
            <Button>
              <Settings color="white" />
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <h3 className="font-medium text-md  mb-4">
              Select points to display:
            </h3>
            <div className="flex flex-wrap gap-5 mb-3">
              <div className="flex items-center space-x-2 mb-2">
                <Switch
                  id="p_peaks"
                  checked={showP}
                  onCheckedChange={(val) => setShowP(val)}
                />
                <Label htmlFor="p_peaks">P peaks</Label>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <Switch
                  id="q_peaks"
                  checked={showQ}
                  onCheckedChange={(val) => setShowQ(val)}
                />
                <Label htmlFor="q_peaks">Q peaks</Label>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <Switch
                  id="s_peaks"
                  checked={showS}
                  onCheckedChange={(val) => setShowS(val)}
                />
                <Label htmlFor="s_peaks">S peaks</Label>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <Switch
                  id="t_peaks"
                  checked={showT}
                  onCheckedChange={(val) => setShowT(val)}
                />
                <Label htmlFor="t_peaks">T peaks</Label>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <canvas ref={chartRef} />
    </div>
  );
};

export default MyChart;