import { useEffect, useState } from 'react'
import { Box, Button, MenuItem, Select, TextField } from '@material-ui/core'
import { ethers } from 'ethers'
import { useGelatoLimitOrders } from '../utils/useGelatoLimitOrders'
import tokensList from '../tokensList.json'
import { APIError, ParaSwap } from 'paraswap'
import { BigNumber } from 'bignumber.js'
import { useWeb3React } from '@web3-react/core'

const useTokensList = () => {
    return tokensList.tokens
}

type MarketRateResponse = {
    rate?: string
    error?: string
}

const useMarketRate = (
    srcToken: string,
    destToken: string,
    srcAmount: string | undefined
):MarketRateResponse => {
    const [rate, setRate] = useState<string | undefined>(undefined)
    const [error, setError] = useState<string | undefined>(undefined)

    useEffect(() => {
        const fetchRate = async () => {
            setRate(undefined)
            setError(undefined)

            if (!srcAmount) return
            
            // create paraswap instance for polygon network
            const paraSwap = new ParaSwap(137)
            const amount = new BigNumber(+srcAmount).multipliedBy(10**18)
            const priceRoute = await paraSwap.getRate(
                srcToken, 
                destToken, 
                amount.toFixed(0),
                undefined,
                undefined,
                undefined,
                18
            )

            // error
            // todo: handle better
            if ('message' in priceRoute) {
                console.error(priceRoute)
                setError((priceRoute as APIError).message)
            } else {
                const marketRate = new BigNumber(priceRoute.destAmount).div(priceRoute.srcAmount)
                setRate(marketRate.toFixed(5))
            }
        }

        fetchRate()
    }, [srcToken, destToken, srcAmount/*, setRate*/])

    return { rate, error }
}

const useOnSubmitLimitOrder = (
    srcTokenAddress: string,
    destTokenAddress: string,
    amount: string | undefined,
    minReturn: string | undefined
) => {
    const gelatoLimitOrders = useGelatoLimitOrders()

    return async () => {
        if (!gelatoLimitOrders || !amount || !minReturn) return

        // Amount to sell
        const inputAmount = ethers.utils.parseUnits(amount, '18')

        // Minimum amount of outTOken which the users wants to receive back
        const outputMinReturn = ethers.utils.parseUnits(minReturn, '18')

        // if not matic
        // todo: better understand this guard
        if (srcTokenAddress !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')
            await gelatoLimitOrders.approveTokenAmount(
                destTokenAddress,
                inputAmount
            )

        const tx = await gelatoLimitOrders.submitLimitOrder(
            srcTokenAddress, // Token to sell
            destTokenAddress, // Token to buy
            inputAmount, // amount to sell
            outputMinReturn // minimum amount received
        )
        const successMessage = `view transaction here https://polygonscan.com/tx/${tx.hash}`
        console.log(successMessage)
    }
}

function TokenInput({
    amount,
    tokenAddress,
    onTokenChange,
    onAmountChange,
}: {
    amount: string | undefined
    tokenAddress: string
    onTokenChange: (address: string) => void
    onAmountChange?: (amount: string) => void
}) {
    const tokensList = useTokensList()

    return (
        <Box flexDirection="row" margin={'20px 0'}>
            <Select
                value={tokenAddress}
                onChange={(event) =>
                    onTokenChange(event.target.value as string)
                }
            >
                {tokensList.map((token) => (
                    <MenuItem key={token.address} value={token.address}>
                        <img
                            src={token.logoURI}
                            alt={token.name}
                            height={40}
                            width={40}
                        />
                    </MenuItem>
                ))}
            </Select>
            <TextField
                value={amount}
                onChange={
                    onAmountChange &&
                    ((evt) => onAmountChange?.(evt.target.value))
                }
                style={{ width: '84%' }}
                variant="outlined"
            />
        </Box>
    )
}

export default function LimitOrder() {
    const defaultAmount = '1'
    const [amount, setAmount] = useState<string>(defaultAmount)
    const [srcTokenAddress, setSrcTokenAddress] = useState<string>(
        '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
    )
    const [destTokenAddress, setDestTokenAddress] = useState<string>(
        '0x42d61d766b85431666b39b89c43011f24451bff6'
    )
    const [desiredRate, setDesiredRate] = useState<string>()
    const { rate: marketRate, error: marketRateError } = useMarketRate(srcTokenAddress, destTokenAddress, amount)
    const rate = desiredRate ?? marketRate

    useEffect(() => {
        setAmount(defaultAmount)
    }, [destTokenAddress])

    const showMinReturn = !!amount && !!rate && !marketRateError
    const minReturn = showMinReturn ? String(+amount * +rate) : undefined

    const onLimitOrder = useOnSubmitLimitOrder(
        srcTokenAddress,
        destTokenAddress,
        amount,
        minReturn,
    )

    // get your public address from metamask
    const { account } = useWeb3React()

    return (
        <Box width={400} justifyContent="center">
            <TokenInput
                amount={amount}
                onAmountChange={setAmount}
                tokenAddress={srcTokenAddress}
                onTokenChange={setSrcTokenAddress}
            />
            <TextField
                type="text"
                value={rate || ''}
                onChange={(evt) => setDesiredRate(evt.target.value)}
                variant="outlined"
                fullWidth
            />
            <TokenInput
                amount={minReturn || ''}
                tokenAddress={destTokenAddress}
                onTokenChange={setDestTokenAddress}
            />
            {marketRateError && <div>
                <strong>There was an error checking the rate:</strong>
                <p>{marketRateError}</p>
            </div>}
            <Button
                variant="contained"
                color="secondary"
                fullWidth
                onClick={onLimitOrder}
                disabled={!account} // TODO: disable submit button if: account not connected OR if balance is insufficient
            >
                Submit sell order
            </Button>
        </Box>
    )
}
