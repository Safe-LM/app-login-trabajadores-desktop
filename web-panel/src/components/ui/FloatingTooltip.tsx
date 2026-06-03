"use client";
import React, { useEffect, useState, useRef } from "react";

export function FloatingTooltip() {
  const [text, setText] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const [visible, setVisible] = useState(false);
  const [adjustedX, setAdjustedX] = useState(0);
  const [adjustedY, setAdjustedY] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let activeElement: HTMLElement | null = null;
    let originalTitle = "";

    const handleMouseOver = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null;
      while (target && target !== document.body) {
        if (target.hasAttribute("title") || target.hasAttribute("data-tooltip")) {
          const tooltipText = target.getAttribute("data-tooltip") || target.getAttribute("title");
          if (tooltipText) {
            activeElement = target;
            if (target.hasAttribute("title")) {
              originalTitle = target.getAttribute("title") || "";
              target.setAttribute("data-original-title", originalTitle);
              target.removeAttribute("title");
            }
            setText(tooltipText);
            
            const rect = target.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const placeBelow = rect.top < 55;
            const y = placeBelow ? rect.bottom + 8 : rect.top - 8;
            
            setPlacement(placeBelow ? "bottom" : "top");
            setCoords({ x, y });
            setVisible(true);
            return;
          }
        }
        target = target.parentElement;
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (activeElement) {
        const orig = activeElement.getAttribute("data-original-title");
        if (orig) {
          activeElement.setAttribute("title", orig);
          activeElement.removeAttribute("data-original-title");
        }
        activeElement = null;
      }
      setVisible(false);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (activeElement && visible) {
        const rect = activeElement.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const placeBelow = rect.top < 55;
        const y = placeBelow ? rect.bottom + 8 : rect.top - 8;
        setPlacement(placeBelow ? "bottom" : "top");
        setCoords({ x, y });
      }
    };

    window.addEventListener("mouseover", handleMouseOver, { passive: true });
    window.addEventListener("mouseout", handleMouseOut, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mouseover", handleMouseOver);
      window.removeEventListener("mouseout", handleMouseOut);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const tooltipRect = ref.current.getBoundingClientRect();
    const padding = 12;
    let x = coords.x;
    let y = coords.y;

    if (x - tooltipRect.width / 2 < padding) {
      x = tooltipRect.width / 2 + padding;
    } else if (x + tooltipRect.width / 2 > window.innerWidth - padding) {
      x = window.innerWidth - tooltipRect.width / 2 - padding;
    }

    setAdjustedX(x);
    setAdjustedY(y);
  }, [coords, visible]);

  const style: React.CSSProperties = {
    left: adjustedX || coords.x,
    top: adjustedY || coords.y,
    transform: `translateX(-50%) ${placement === "top" ? "translateY(-100%)" : "translateY(0%)"} scale(${visible ? 1 : 0.95})`,
    visibility: text && visible ? "visible" : "hidden",
  };

  return (
    <div
      ref={ref}
      className={`premium-tooltip ${visible ? "premium-tooltip--visible" : ""}`}
      style={style}
    >
      {text}
    </div>
  );
}
