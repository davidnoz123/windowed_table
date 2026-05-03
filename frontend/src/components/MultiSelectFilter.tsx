import { useState, useRef, useEffect } from 'react'

interface MultiSelectFilterProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  width: number
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  width,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  const displayText =
    selected.length === 0 || selected.length === options.length
      ? `All ${label}`
      : `${label} (${selected.length})`

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: width - 8 }}>
      <button
        data-testid={`multiselect-${label.toLowerCase()}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '4px 6px',
          border: '1px solid #ccc',
          borderRadius: 3,
          background: '#fff',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        {displayText}
      </button>

      {isOpen && (
        <div
          data-testid={`multiselect-dropdown-${label.toLowerCase()}`}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            maxHeight: 200,
            overflow: 'auto',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 3,
            marginTop: 2,
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {options.map(option => (
            <label
              key={option}
              data-testid={`multiselect-option-${option}`}
              style={{
                display: 'block',
                padding: '6px 8px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#f0f0f0'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fff'
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => handleToggleOption(option)}
                style={{ marginRight: 8 }}
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
