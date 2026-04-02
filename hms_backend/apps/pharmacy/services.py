"""Business services for pharmacy dispensing, payment validation, and reporting."""

from dataclasses import dataclass

from utils.exceptions import ValidationError


@dataclass
class PaymentComputation:
    """Computed payment totals derived from dispense items and debt state."""

    medicines_total: float
    total_due: float
    cash_amount: float
    online_amount: float
    new_debt: float
    debt_cleared: float


class PaymentValidator:
    """Validates and normalizes checkout payment payloads."""

    TOLERANCE = 0.01

    @classmethod
    def validate(cls, payment_data: dict, medicines_total: float, outstanding_debt: float) -> PaymentComputation:
        method = payment_data.get('method')
        cash_amount = float(payment_data.get('cash_amount', 0.0) or 0.0)
        online_amount = float(payment_data.get('online_amount', 0.0) or 0.0)
        new_debt = float(payment_data.get('new_debt', 0.0) or 0.0)
        debt_cleared = float(payment_data.get('debt_cleared', 0.0) or 0.0)

        if method not in ('cash', 'online', 'split', 'debt'):
            raise ValidationError(code='INVALID_PAYMENT_METHOD', message='Invalid payment method.')

        if debt_cleared < 0 or new_debt < 0 or cash_amount < 0 or online_amount < 0:
            raise ValidationError(code='INVALID_PAYMENT_VALUES', message='Payment values cannot be negative.')

        if debt_cleared > outstanding_debt + cls.TOLERANCE:
            raise ValidationError(code='DEBT_CLEARED_EXCEEDS_OUTSTANDING', message='debt_cleared cannot exceed outstanding debt.')

        total_due = float(medicines_total + outstanding_debt)
        summed = float(cash_amount + online_amount + new_debt)
        if abs(summed - total_due) > cls.TOLERANCE:
            raise ValidationError(
                code='PAYMENT_TOTAL_MISMATCH',
                message='cash_amount + online_amount + new_debt must match total_due.',
            )

        if method == 'debt' and not (cash_amount == 0 and online_amount == 0 and abs(new_debt - total_due) <= cls.TOLERANCE):
            raise ValidationError(code='INVALID_DEBT_PAYMENT', message='Debt method must put full amount into new_debt.')

        if method == 'cash' and not (online_amount == 0 and new_debt == 0 and abs(cash_amount - total_due) <= cls.TOLERANCE):
            raise ValidationError(code='INVALID_CASH_PAYMENT', message='Cash payment must cover full total_due in cash.')

        if method == 'online' and not (cash_amount == 0 and new_debt == 0 and abs(online_amount - total_due) <= cls.TOLERANCE):
            raise ValidationError(code='INVALID_ONLINE_PAYMENT', message='Online payment must cover full total_due online.')

        return PaymentComputation(
            medicines_total=medicines_total,
            total_due=total_due,
            cash_amount=cash_amount,
            online_amount=online_amount,
            new_debt=new_debt,
            debt_cleared=debt_cleared,
        )
