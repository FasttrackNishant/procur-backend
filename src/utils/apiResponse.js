
// template for api response

export function successResponse(res, { data = null, message = 'OK', meta = null, status = 200 } = {}) {
  const payload = { ok: true, message };
  if (meta !== null) payload.meta = meta;
  payload.data = data;
  return res.status(status).json(payload);
}

export function errorResponse(res, { error = 'Server error', errorCode = null, status = 500 } = {}) {
  const payload = { ok: false, error: typeof error === 'string' ? error : (error.message || 'Error') };
  if (errorCode) payload.code = errorCode;
  return res.status(status).json(payload);
}