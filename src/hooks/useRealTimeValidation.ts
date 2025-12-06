import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';

interface ValidationField {
  value: string;
  error: string | null;
  touched: boolean;
  valid: boolean;
}

interface UseRealTimeValidationProps {
  schemas: Record<string, z.ZodSchema>;
  debounceMs?: number;
}

export const useRealTimeValidation = ({ 
  schemas, 
  debounceMs = 300 
}: UseRealTimeValidationProps) => {
  const [fields, setFields] = useState<Record<string, ValidationField>>(() => {
    const initialFields: Record<string, ValidationField> = {};
    Object.keys(schemas).forEach(key => {
      initialFields[key] = {
        value: '',
        error: null,
        touched: false,
        valid: false,
      };
    });
    return initialFields;
  });

  const [debounceTimers, setDebounceTimers] = useState<Record<string, NodeJS.Timeout>>({});

  const validateField = useCallback((fieldName: string, value: string) => {
    const schema = schemas[fieldName];
    if (!schema) return;

    try {
      schema.parse(value);
      setFields(prev => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          value,
          error: null,
          valid: true,
        }
      }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        setFields(prev => ({
          ...prev,
          [fieldName]: {
            ...prev[fieldName],
            value,
            error: error.errors[0]?.message || 'Invalid value',
            valid: false,
          }
        }));
      }
    }
  }, [schemas]);

  const updateField = useCallback((fieldName: string, value: string, immediate = false) => {
    console.log('🔴 DEBUG: updateField called for', fieldName, 'value length:', value.length, 'immediate:', immediate);
    
    // Update value immediately
    setFields(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        value,
        touched: true,
      }
    }));

    // Clear existing timer
    if (debounceTimers[fieldName]) {
      clearTimeout(debounceTimers[fieldName]);
    }

    // Set up debounced validation
    const timer = setTimeout(() => {
      console.log('🔴 DEBUG: Debounced validation triggered for', fieldName, '- this may cause re-render and focus loss');
      validateField(fieldName, value);
      setDebounceTimers(prev => {
        const newTimers = { ...prev };
        delete newTimers[fieldName];
        return newTimers;
      });
    }, immediate ? 0 : debounceMs);

    setDebounceTimers(prev => ({
      ...prev,
      [fieldName]: timer,
    }));
  }, [validateField, debounceTimers, debounceMs]);

  const validateAllFields = useCallback(() => {
    const errors: Record<string, string> = {};
    let isValid = true;

    Object.entries(fields).forEach(([fieldName, field]) => {
      if (field.touched) {
        try {
          schemas[fieldName]?.parse(field.value);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors[fieldName] = error.errors[0]?.message || 'Invalid value';
            isValid = false;
          }
        }
      }
    });

    return { errors, isValid };
  }, [fields, schemas]);

  const resetField = useCallback((fieldName: string) => {
    setFields(prev => ({
      ...prev,
      [fieldName]: {
        value: '',
        error: null,
        touched: false,
        valid: false,
      }
    }));

    if (debounceTimers[fieldName]) {
      clearTimeout(debounceTimers[fieldName]);
      setDebounceTimers(prev => {
        const newTimers = { ...prev };
        delete newTimers[fieldName];
        return newTimers;
      });
    }
  }, [debounceTimers]);

  const resetAllFields = useCallback(() => {
    Object.keys(fields).forEach(resetField);
  }, [fields, resetField]);

  const getFieldProps = useCallback((fieldName: string) => ({
    value: fields[fieldName]?.value || '',
    error: fields[fieldName]?.error,
    touched: fields[fieldName]?.touched || false,
    valid: fields[fieldName]?.valid || false,
    onChange: (value: string) => updateField(fieldName, value),
    onBlur: () => updateField(fieldName, fields[fieldName]?.value || '', true),
  }), [fields, updateField]);

  const isFormValid = useMemo(() => {
    return Object.values(fields).every(field => 
      !field.touched || (field.touched && field.valid)
    );
  }, [fields]);

  const hasErrors = useMemo(() => {
    return Object.values(fields).some(field => 
      field.touched && field.error
    );
  }, [fields]);

  return {
    fields,
    updateField,
    validateAllFields,
    resetField,
    resetAllFields,
    getFieldProps,
    isFormValid,
    hasErrors,
  };
};

export default useRealTimeValidation;