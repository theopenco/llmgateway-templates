"use client";

import { memo, useCallback, useState } from "react";
import { CheckIcon, ChevronsUpDown } from "lucide-react";

import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/model-selector";
import { providerLabel } from "@/components/provider-icons";
import { Button } from "@/components/ui/button";
import { groupByFamily, type Model } from "@/lib/models";
import { cn } from "@/lib/utils";

const ModelItem = memo(
  ({
    model,
    selected,
    onSelect,
  }: {
    model: Model;
    selected: boolean;
    onSelect: (id: string) => void;
  }) => {
    const handleSelect = useCallback(
      () => onSelect(model.id),
      [onSelect, model.id],
    );

    return (
      <ModelSelectorItem
        onSelect={handleSelect}
        value={`${model.name} ${model.id}`}
      >
        <ModelSelectorLogo provider={model.family} />
        <ModelSelectorName>{model.name}</ModelSelectorName>
        <ModelSelectorLogoGroup>
          {model.providers.map((provider) => (
            <ModelSelectorLogo key={provider} provider={provider} />
          ))}
        </ModelSelectorLogoGroup>
        {selected ? (
          <CheckIcon className="ml-2 size-4" />
        ) : (
          <div className="ml-2 size-4" />
        )}
      </ModelSelectorItem>
    );
  },
);

ModelItem.displayName = "ModelItem";

export type ModelPickerProps = {
  models: Model[];
  value: string;
  onChange: (id: string) => void;
  /** Applied to the trigger button. */
  className?: string;
  size?: "sm" | "default";
  placeholder?: string;
};

/**
 * Searchable model picker built on the AI Elements model selector, filled from
 * the gateway catalog.
 *
 * @see https://elements.ai-sdk.dev/components/model-selector
 */
export function ModelPicker({
  models,
  value,
  onChange,
  className,
  size = "default",
  placeholder = "Select model",
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = models.find((model) => model.id === value);

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <ModelSelector open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={cn(
            "justify-between",
            size === "sm" && "text-xs",
            className,
          )}
        >
          {selected ? (
            <>
              <ModelSelectorLogo provider={selected.family} />
              <ModelSelectorName>{selected.name}</ModelSelectorName>
            </>
          ) : (
            <ModelSelectorName className="text-muted-foreground">
              {placeholder}
            </ModelSelectorName>
          )}
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {groupByFamily(models).map(([family, familyModels]) => (
            <ModelSelectorGroup heading={providerLabel(family)} key={family}>
              {familyModels.map((model) => (
                <ModelItem
                  key={model.id}
                  model={model}
                  onSelect={handleSelect}
                  selected={model.id === value}
                />
              ))}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}
